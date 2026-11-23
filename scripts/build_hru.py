"""Robert's coo for notifications: a real pigeon, cut from a public domain recording.

Source: "Dove cooing" by mary905, public domain (pdsounds.org), on Wikimedia Commons:
https://commons.wikimedia.org/wiki/File:Dove_cooing.ogg
No attribution is required; it is credited in the README anyway.

The recording (7.9 s) holds three coo phrases. We keep the first two (1.0-4.95 s), fade the edges
and normalise it, then write public/golob-hru.wav and the Android notification sound
android/app/src/main/res/raw/golob_hru.wav.

The .ogg has to be decoded to a 22.05 kHz mono 16-bit WAV first (any audio tool, or Chrome's
decodeAudioData). Then:  python scripts/build_hru.py path/to/dove_cooing.wav
"""
import math
import shutil
import struct
import sys
import wave

START, END = 1.0, 4.95  # seconds kept from the recording
FADE_IN, FADE_OUT = 0.03, 0.25
PEAK = 0.89  # about -1 dBFS


def main(src):
    with wave.open(src, 'rb') as w:
        assert w.getnchannels() == 1 and w.getsampwidth() == 2, 'expects 16-bit mono WAV'
        rate = w.getframerate()
        raw = w.readframes(w.getnframes())
    x = list(struct.unpack('<%dh' % (len(raw) // 2), raw))[int(START * rate):int(END * rate)]
    n = len(x)
    fi, fo = int(FADE_IN * rate), int(FADE_OUT * rate)
    peak = max(abs(v) for v in x) or 1
    gain = PEAK * 32767 / peak
    out = []
    for i, v in enumerate(x):
        g = gain
        if i < fi:
            g *= math.sin(i / fi * math.pi / 2) ** 2
        if i > n - fo:
            g *= math.cos((i - (n - fo)) / fo * math.pi / 2) ** 2
        out.append(max(-32767, min(32767, int(v * g))))
    dst = 'public/golob-hru.wav'
    with wave.open(dst, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack('<%dh' % len(out), *out))
    shutil.copyfile(dst, 'android/app/src/main/res/raw/golob_hru.wav')
    print(dst, round(n / rate, 2), 's, gain x', round(gain, 2))


if __name__ == '__main__':
    main(sys.argv[1])
