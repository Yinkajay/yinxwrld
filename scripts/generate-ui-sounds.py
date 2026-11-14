"""Generate the original, tiny WAV cues used by the yinxwrld interface."""

from math import exp, pi, sin
from pathlib import Path
import struct
import wave


RATE = 44_100
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "sounds"


def tone(duration, frequency, decay=30, partial=0):
    count = int(RATE * duration)
    samples = []
    for index in range(count):
        time = index / RATE
        phase = 2 * pi * frequency * time
        value = sin(phase) + (partial * sin(phase * 2.01) if partial else 0)
        samples.append(value * exp(-decay * time))
    return samples


def sweep(duration, start, end, decay=24, partial=0):
    count = int(RATE * duration)
    samples = []
    for index in range(count):
        time = index / RATE
        progress = time / duration
        frequency = start + (end - start) * progress
        phase = 2 * pi * (start * time + (end - start) * time * progress / 2)
        value = sin(phase) + (partial * sin(phase * 2.01) if partial else 0)
        samples.append(value * exp(-decay * time))
    return samples


def tap():
    base = tone(0.048, 1_850, 48)
    return [sample + 0.24 * sin(2 * pi * 2_800 * i / RATE) * exp(-95 * i / RATE) for i, sample in enumerate(base)]


def complete():
    first = sweep(0.088, 620, 830, 22, 0.15)
    second = [0.42 * value for value in tone(0.062, 1_020, 32)]
    return first + [0.0] * int(RATE * 0.018) + second


def reopen():
    return sweep(0.095, 920, 570, 25, 0.12)


def save():
    first = tone(0.052, 690, 36, 0.1)
    second = [0.56 * value for value in tone(0.068, 900, 30, 0.08)]
    return first + [0.0] * int(RATE * 0.025) + second


def add():
    first = tone(0.046, 590, 42, 0.08)
    second = [0.48 * value for value in sweep(0.074, 760, 980, 28, 0.08)]
    return first + [0.0] * int(RATE * 0.018) + second


def delete():
    return sweep(0.092, 510, 320, 38, 0.16)


def pickup():
    first = sweep(0.052, 460, 720, 38)
    return first


def drop():
    body = tone(0.105, 540, 26, 0.22)
    bright = tone(0.078, 1_080, 34)
    return [sample + 0.22 * bright[i] for i, sample in enumerate(body[:len(bright)])] + body[len(bright):]


def write(name, samples):
    peak = max((abs(sample) for sample in samples), default=1) or 1
    gain = min(1, 0.42 / peak)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUTPUT / f"{name}.wav"), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(RATE)
        file.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, sample * gain)) * 32767)) for sample in samples))


if __name__ == "__main__":
    for name, build in {
        "tap": tap,
        "complete": complete,
        "reopen": reopen,
        "save": save,
        "add": add,
        "delete": delete,
        "drag-pickup": pickup,
        "drop": drop,
    }.items():
        write(name, build())
