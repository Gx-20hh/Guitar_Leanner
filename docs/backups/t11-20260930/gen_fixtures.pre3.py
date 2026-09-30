#!/usr/bin/env python3
"""GP5 fixture generator using PyGuitarPro (import guitarpro) — 生成内容已知的真实 GP5.

PyGuitarPro 的 Song/Track/Measure/Voice/GuitarString 会在构造时预置默认对象，
因此本脚本复用默认对象并改写，避免产生多余轨/弦。
内容：标题 "GP5 Fixture"；tempo 120；一条 6 弦音轨 "Guitar"（弦 1=低 E2(40) …
弦 6=高 e4(64)）；一个小节 4/4；两拍（Quarter）：
  拍0: 弦 2(D) fret0、动态 F，无技巧
  拍1: 弦 1(A) fret3、动态 MP，hammer-on（NoteEffect.hammer）
写为 GP5（version (5,0,0)）。

Regenerate: `python gen_fixtures.py`
"""
import os
import guitarpro as gp

OUT = os.path.join(os.path.dirname(__file__), "out.gp5")


def build() -> gp.Song:
    song = gp.Song()
    song.title = "GP5 Fixture"
    song.tempo = 120
    song.tempoName = ""

    # 复用默认单轨
    track = song.tracks[0]
    track.number = 0
    track.name = "Guitar"
    # 复用默认 6 弦并设置 MIDI 值：弦 1=低 E2(40) … 弦 6=高 e4(64)
    for gs, midi in zip(track.strings, [40, 45, 50, 55, 59, 64]):
        gs.value = midi
    # 保证弦数正确
    while len(track.strings) < 6:
        track.strings.append(gp.GuitarString(len(track.strings) + 1, 40))
    del track.strings[6:]

    # 复用默认小节/拍号（默认已为 4/4，denominator 为 Duration 对象，勿用 TimeSignature(4,4) 覆写）
    header = song.measureHeaders[0]
    measure = track.measures[0]
    voice = measure.voices[0]

    def make_beat(start, duration, string, fret, velocity, hammer=False):
        b = gp.Beat(voice)
        b.start = start
        b.duration = duration
        n = gp.Note(b)
        n.string = string
        n.value = fret
        n.velocity = velocity
        if hammer:
            effect = gp.NoteEffect()
            effect.hammer = True
            n.effect = effect
        b.notes.append(n)
        return b

    b0 = make_beat(0, gp.Duration(4), 2, 0, 96)        # D 弦 fret0, F
    b1 = make_beat(240, gp.Duration(4), 1, 3, 80, True) # A 弦 fret3, MP, hammer
    voice.beats.append(b0)
    voice.beats.append(b1)

    return song


def main():
    song = build()
    with open(OUT, "wb") as stream:
        gp.io.write(song, stream, version=(5, 0, 0))
    size = os.path.getsize(OUT)
    print("wrote", OUT, "bytes", size)
    with open(OUT, "rb") as stream:
        again = gp.parse(stream)
    t = again.tracks[0]
    beatc = len(t.measures[0].voices[0].beats)
    print("re-parse ok: title=%r tracks=%d tempo=%d strings=%d beats=%d"
          % (again.title, len(again.tracks), again.tempo, len(t.strings), beatc))


if __name__ == "__main__":
    main()
