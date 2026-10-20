# Benchmarking Assemblyscript vs. Typescript on V8

So I want to lean into the "fictional retro console" vibe a little bit, while remaining lightweight.

I've looked at other languages that the wamicom might support: Pascal, Forth, WAT.

Pascal is fun because:

1. it's fast and low level
2. it's a bit unfamiliar
3. it's implies an alternate history where pascal was taken more seriously in gamedev and elsewhere

I'm leaning away right now because it's a bit too unfamiliar and the best compilers are also designed to bring the whole stdlib, so it feels like it's slightly annoying to have to turn all that off.

Now I'm looking at AssemblyScript, this is fun because:

1. it's fast and low level (ish)

Less fun because:

2. it's ... too familiar
3. the alternate history is obvious nonsense?

... but the familiarity is also good, for accessibility, and a silly alternate history can be fun.

So for me the joke only works if it's actually faster.

I'm going to translate a few of the programs we've written, put them into a different harness and benchmark how many FPS we get on node.js, in a browser and on a phone browser. (excluding actually rendering them to a screen).
