#!/usr/bin/env python3
"""T12 playback fixture generator: repeat, tempo change, ties."""
import os
import guitarpro as gp

DIR = os.path.dirname(__file__)
TUNING = [64, 59, 55, 50, 45, 40]

def new_song(title, tempo=120):
    s = gp.Song()
    s.title = title
    s.tempo = tempo
    t = s.tracks[0]
    t.name = "Guitar"
    for gs, midi in zip(t.strings, TUNING):
        gs.value = midi
    return s, t

def mk_beat(voice, start, string, fret, dur=4, vel=96):
    b = gp.Beat(voice)
    b.start = start
    b.duration = gp.Duration(dur)
    n = gp.Note(b)
    n.string = string
    n.value = fret
    n.velocity = vel
    b.notes.append(n)
    voice.beats.append(b)
    return b, n

# 1) repeat: 2 bars, repeat 2x
s, t = new_song("T12 Repeat")
m0 = t.measures[0]  # bar 0
vk0 = m0.voices[0]
mk_beat(vk0, 0, 1, 0)
mk_beat(vk0, 240, 1, 0)

# add second measure via song.measureHeaders
import copy
mh1 = copy.deepcopy(s.measureHeaders[0])
s.measureHeaders.append(mh1)
m1 = gp.Measure(t, mh1)
m1.header = mh1
vk1 = m1.voices[0]
mk_beat(vk1, 0, 6, 5)
t.measures.append(m1)

# set repeat: bar 0 opening, bar 1 repeatClose=2
s.measureHeaders[0].isRepeatOpen = True
s.measureHeaders[1].repeatClose = 2

with open(os.path.join(DIR, "t12-repeat.gp5"), "wb") as f:
    gp.io.write(s, f, version=(5, 0, 0))
print("t12-repeat.gp5 written", os.path.getsize(os.path.join(DIR, "t12-repeat.gp5")))

# 2) tempo: 2 bars, tempo 120 -> 60
s, t = new_song("T12 Tempo")
m0 = t.measures[0]
vk0 = m0.voices[0]
mk_beat(vk0, 0, 1, 0)
mk_beat(vk0, 240, 1, 0)

mh1 = copy.deepcopy(s.measureHeaders[0])
s.measureHeaders.append(mh1)
m1 = gp.Measure(t, mh1)
m1.header = mh1
vk1 = m1.voices[0]
mk_beat(vk1, 0, 1, 0)
t.measures.append(m1)

mtc = gp.MixTableChange()
mtc.tempo = gp.MixTableItem(60)
mtc.position = 1
s.measureHeaders[1].mixTableChange = mtc

with open(os.path.join(DIR, "t12-tempo.gp5"), "wb") as f:
    gp.io.write(s, f, version=(5, 0, 0))
print("t12-tempo.gp5 written", os.path.getsize(os.path.join(DIR, "t12-tempo.gp5")))

# 3) ties: 4 quarters in 1 bar, all tied
s, t = new_song("T12 Tie")
m0 = t.measures[0]
vk0 = m0.voices[0]
b1, n1 = mk_beat(vk0, 0, 1, 0)
n1.type = gp.NoteType.tie
b2, n2 = mk_beat(vk0, 240, 1, 0)
n2.type = gp.NoteType.tie
b3, n3 = mk_beat(vk0, 480, 1, 0)
n3.type = gp.NoteType.tie
b4, n4 = mk_beat(vk0, 720, 1, 0)
n4.type = gp.NoteType.tie

with open(os.path.join(DIR, "t12-tie.gp5"), "wb") as f:
    gp.io.write(s, f, version=(5, 0, 0))
print("t12-tie.gp5 written", os.path.getsize(os.path.join(DIR, "t12-tie.gp5")))

print("Done: repeat, tempo, tie fixtures generated.")
