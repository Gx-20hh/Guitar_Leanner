#!/usr/bin/env python3
"""GP5 fixture generator using PyGuitarPro (import guitarpro) — 生成**约定标准调弦**的真实 GP5.

约定：PyGuitarPro/Guitar Pro 弦号 string1 = 最高弦(高 e, MIDI 64)，string6 = 最低弦(低 E, 40)。
调弦（string1..6）= [64, 59, 55, 50, 45, 40]（不按音高排序、保物理弦序）。
内容：标题 "GP5 Fixture"；tempo 120；单音轨 "Guitar" 四四拍。
两拍（Quarter）均 fret0，独立音乐值：
  拍1: 最高弦 string1 fret0 → MIDI 64
  拍2: 最低弦 string6 fret0 → MIDI 40
PyGuitarPro 构造预置默认轨/弦/拍号(Duration 对象)，脚本复用默认对象改写；Note 需显式 b.notes.append。
"""
import os
import guitarpro as gp

OUT = os.path.join(os.path.dirname(__file__), "out.gp5")


def build() -> gp.Song:
    song = gp.Song()
    song.title = "GP5 Fixture"
    song.tempo = 120
    song.tempoName = ""

    track = song.tracks[0]
    track.number = 0
    track.name = "Guitar"
    track.offset = 2  # capo 高度（品位 2；PyGuitarPro 以 track.offset 表示 capo，见 GP5File.writeTrack）
    # 约定标准调弦 string1=64(高e) … string6=40(低E)
    for gs, midi in zip(track.strings, [64, 59, 55, 50, 45, 40]):
        gs.value = midi
    while len(track.strings) < 6:
        track.strings.append(gp.GuitarString(len(track.strings) + 1, 40))
    del track.strings[6:]

    header = song.measureHeaders[0]
    measure = track.measures[0]
    voice = measure.voices[0]

    def make_beat(start, string, fret, velocity):
        b = gp.Beat(voice)
        b.start = start
        b.duration = gp.Duration(4)
        n = gp.Note(b)
        n.string = string  # PyGuitarPro 弦号：1=最高
        n.value = fret
        n.velocity = velocity
        b.notes.append(n)
        return b

    voice.beats.append(make_beat(0, 1, 0, 96))    # 最高弦 e fret0 → 64
    voice.beats.append(make_beat(240, 6, 0, 80))  # 最低弦 E fret0 → 40

    return song


def main():
    song = build()
    with open(OUT, "wb") as stream:
        gp.io.write(song, stream, version=(5, 0, 0))
    size = os.path.getsize(OUT)
    with open(OUT, "rb") as stream:
        again = gp.parse(stream)
    t = again.tracks[0]
    notes = []
    for v in t.measures[0].voices:
        for b in v.beats:
            for n in b.notes:
                notes.append((n.string, n.value))
    print("wrote", OUT, "bytes", size)
    print("re-parse: title=%r track=%r strings=%r tempo=%d notes=%r"
          % (again.title, t.name, [gs.value for gs in t.strings][:6], again.tempo, notes))


if __name__ == "__main__":
    main()
