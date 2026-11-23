"""Robert's coo, "hru hru hruuu", synthesised from scratch (no samples, no licences) into public/golob-hru.wav.

A feral pigeon's coo is a low, throaty tone that rises and falls, starts with a short rolled "hr"
and has a soft breathy edge. Each syllable here is a gliding fundamental with a few harmonics,
a fast tremolo for the roll, a little filtered noise for the breath and a gentle envelope.
Pure standard library, so it runs anywhere: python scripts/build_hru.py
"""
import math
import random
import struct
import wave

RATE = 22050
random.seed(7)


def syllable(dur, f0, f_peak, f_end, roll=0.12):
    """One "hru": pitch glides f0 -> f_peak (at 35 %) -> f_end, amplitude rolls during the first `roll` seconds."""
    n = int(dur * RATE)
    out = []
    phase = 0.0
    noise = 0.0
    for i in range(n):
        t = i / RATE
        x = i / n
        # pitch contour: up quickly, then a slow sag
        if x < 0.35:
            f = f0 + (f_peak - f0) * math.sin(x / 0.35 * math.pi / 2)
        else:
            f = f_peak + (f_end - f_peak) * ((x - 0.35) / 0.65) ** 1.3
        f *= 1 + 0.012 * math.sin(2 * math.pi * 6 * t)  # slight wobble
        phase += 2 * math.pi * f / RATE
        # throaty timbre: fundamental plus soft harmonics
        s = math.sin(phase) + 0.45 * math.sin(2 * phase + 0.3) + 0.18 * math.sin(3 * phase + 0.7) + 0.06 * math.sin(4 * phase)
        # rolled "hr" at the start: fast tremolo that fades out
        if t < roll:
            depth = 1 - t / roll
            s *= 1 - 0.75 * depth * (0.5 + 0.5 * math.sin(2 * math.pi * 34 * t))
        # breath: low-passed noise, stronger at the start
        noise = 0.92 * noise + 0.08 * (random.random() * 2 - 1)
        s += noise * (0.9 if t < roll else 0.35)
        # envelope: 35 ms attack, gentle swell, soft 30 % release
        att = min(1.0, t / 0.035)
        rel = 1.0 if x < 0.7 else math.cos((x - 0.7) / 0.3 * math.pi / 2) ** 2
        swell = 0.8 + 0.2 * math.sin(x * math.pi)
        out.append(s * att * rel * swell)
    return out


def silence(dur):
    return [0.0] * int(dur * RATE)


def lowpass(xs, a=0.35):
    """One-pole low-pass to round off the edges, a pigeon is a soft sound."""
    y = 0.0
    res = []
    for x in xs:
        y += a * (x - y)
        res.append(y)
    return res


def main():
    sig = []
    sig += syllable(0.34, 330, 420, 360)
    sig += silence(0.10)
    sig += syllable(0.34, 340, 430, 365)
    sig += silence(0.12)
    sig += syllable(0.70, 330, 440, 300, roll=0.15)  # the long, falling "hruuu"
    sig += silence(0.15)
    sig = lowpass(sig)
    peak = max(abs(v) for v in sig) or 1
    gain = 0.7 * 32767 / peak
    with wave.open('public/golob-hru.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(v * gain)) for v in sig))
    print('public/golob-hru.wav', round(len(sig) / RATE, 2), 's')


if __name__ == '__main__':
    main()
