document.addEventListener("DOMContentLoaded", () => {
    // Объявляем переменные для записи аудио
    let mediaRecorder;
    let audioChunks = [];
    let audioStream;

    // Элементы интерфейса
    const recordBtn = document.getElementById("record-btn");
    const stopBtn = document.getElementById("stop-btn");
    const sendBtn = document.getElementById("send-btn");
    const uploadBtn = document.getElementById("upload-btn");
    const userInput = document.getElementById("user-input");
    const chatBox = document.getElementById("chat-box");
    const audioFileInput = document.getElementById("audio-file");

    // ===== 1. Отправка текста =====
    sendBtn.addEventListener("click", async () => {
        const text = userInput.value.trim();
        if (!text) return;

        appendMessage("user", text);
        userInput.value = "";

        try {
            const response = await fetch("/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });

            if (!response.ok) throw new Error("Ошибка сервера");

            const data = await response.json();
            appendMessage("bot", `Эмоция: ${data.emotion} (${(data.confidence * 100).toFixed(1)}%)`);
        } catch (error) {
            console.error("Ошибка:", error);
            appendMessage("bot", `❌ Ошибка: ${error.message}`);
        }
    });

    // ===== 2. Загрузка аудиофайла =====
    uploadBtn.addEventListener("click", async () => {
        const file = audioFileInput.files[0];
        if (!file) return;

        appendMessage("user", "Загружен аудиофайл...");

        try {
            const formData = new FormData();
            formData.append("audio", file);

            const response = await fetch("/analyze_audio", {
                method: "POST",
                body: formData
            });

            if (!response.ok) throw new Error("Ошибка сервера");

            const data = await response.json();
            appendMessage("bot", `Эмоция: ${data.emotion} (${(data.confidence * 100).toFixed(1)}%)`);
        } catch (error) {
            console.error("Ошибка:", error);
            appendMessage("bot", `❌ Ошибка: ${error.message}`);
        }
    });

    // ===== 3. Запись аудио =====
    recordBtn.addEventListener("click", async () => {
        try {
            // Запрашиваем доступ к микрофону
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Настраиваем запись
            mediaRecorder = new MediaRecorder(audioStream);
            audioChunks = [];

            // Обработчики событий
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

            mediaRecorder.onstop = async () => {
                try {
                    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                    appendMessage("user", "Отправлено голосовое сообщение...");

                    const formData = new FormData();
                    formData.append("audio", audioBlob, "recording.wav");

                    const response = await fetch("/analyze_audio", {
                        method: "POST",
                        body: formData
                    });

                    if (!response.ok) throw new Error("Ошибка сервера");

                    const data = await response.json();
                    appendMessage("bot", `Эмоция: ${data.emotion} (${(data.confidence * 100).toFixed(1)}%)`);
                } catch (error) {
                    console.error("Ошибка:", error);
                    appendMessage("bot", `❌ Ошибка: ${error.message}`);
                } finally {
                    // Освобождаем ресурсы
                    audioStream.getTracks().forEach(track => track.stop());
                }
            };

            mediaRecorder.start();
            recordBtn.disabled = true;
            stopBtn.disabled = false;

        } catch (error) {
            console.error("Ошибка записи:", error);
            appendMessage("bot", "❌ Не удалось получить доступ к микрофону");
        }
    });

    // Остановка записи
    stopBtn.addEventListener("click", () => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            recordBtn.disabled = false;
            stopBtn.disabled = true;
        }
    });

    // ===== Вспомогательные функции =====
    function appendMessage(sender, text) {
        const message = document.createElement("div");
        message.classList.add("message", sender === "user" ? "user-message" : "bot-message");
        message.innerHTML = text; // Используем innerHTML для поддержки эмодзи
        chatBox.appendChild(message);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});