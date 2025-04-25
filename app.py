from flask import Flask, request, jsonify, render_template
from transformers import pipeline
import torch
import torchaudio
from pydub import AudioSegment
import os
import io
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
from transformers import AutoModelForAudioClassification, AutoFeatureExtractor



app = Flask(__name__)

# Обновлённый словарь эмоций с surprise
emotion_map = {
    'joy': '😊 Радость',
    'neutral': '😐 Нейтрально',
    'anger': '😠 Злость',
    'sadness': '😢 Грусть',
    'surprise': '😲 Удивление'
}

# Добавим ffmpeg и ffprobe в PATH
os.environ["PATH"] = r"C:\ffmpeg\bin;" + os.environ["PATH"]

# Модель для текста
text_classifier = pipeline("text-classification", model="cointegrated/rubert-tiny2-cedr-emotion-detection", top_k=None)

# Модель для аудио
# Аудио модель: универсальная, с поддержкой русского
audio_classifier = pipeline(
    "audio-classification",
    model="superb/hubert-large-superb-er",
    device=0 if torch.cuda.is_available() else -1
)


@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze_text():
    data = request.get_json()
    text = data.get("text", "")
    if not text.strip():
        return jsonify({"error": "Пустой текст."}), 400

    predictions = text_classifier(text)[0]
    if not predictions:
        return jsonify({"emotion": "❓ Не определено", "confidence": 0.0})

    top_prediction = max(predictions, key=lambda x: x["score"])
    label = top_prediction["label"]
    confidence = round(top_prediction["score"], 2)

    if confidence < 0.5:
        return jsonify({"emotion": "🤔 Неуверенно", "confidence": confidence})

    emotion = emotion_map.get(label, "❓ Неизвестно")
    return jsonify({"emotion": emotion, "confidence": confidence})

from pydub.utils import which

# Проверка на наличие ffmpeg
if not which("ffmpeg"):
    print("FFmpeg не найден в системе!")


@app.route('/analyze_audio', methods=['POST'])
def analyze_audio():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'Аудио файл обязателен'}), 400

        audio_file = request.files['audio']
        temp_path = "temp_audio.wav"

        # Конвертация в формат для модели
        audio = AudioSegment.from_file(io.BytesIO(audio_file.read()))
        audio = audio.set_frame_rate(16000).set_channels(1)
        audio.export(temp_path, format="wav", codec="pcm_s16le")  # Явно указываем кодек

        # Анализ
        result = audio_classifier(temp_path)
        os.remove(temp_path)

        # Отладочный вывод
        print("Raw model output:", result)

        # Сопоставление с эмоциями
        # Новый маппинг
        emotion_mapping = {
            'hap': 'happy',
            'sad': 'sad',
            'neu': 'neutral',
            'ang': 'angry'
        }

        # Сбор эмоций
        emotions = {v: 0.0 for v in emotion_mapping.values()}

        for item in result:
            label = item['label'].lower()
            score = item['score']
            if label in emotion_mapping:
                key = emotion_mapping[label]
                emotions[key] += score

        # Нормализация
        total = sum(emotions.values())
        if total == 0:
            return jsonify({'error': 'Не удалось распознать эмоции'}), 500

        emotions = {k: round(v / total, 4) for k, v in emotions.items()}
        dominant_emotion = max(emotions.items(), key=lambda x: x[1])

        # Маппинг для ответа
        response_map = {
            'happy': '😊 Радость',
            'sad': '😢 Грусть',
            'angry': '😠 Злость',
            'neutral': '😐 Нейтрально'
        }

        return jsonify({
            'emotion': response_map.get(dominant_emotion[0], 'неизвестно'),
            'confidence': dominant_emotion[1],
            'details': emotions
        })

    except Exception as e:
        print(f"Ошибка анализа аудио: {str(e)}")
        return jsonify({'error': 'Ошибка обработки аудио'}), 500


if __name__ == "__main__":
    app.run(debug=True)

if __name__ == "__main__":
    app.run(debug=True)
