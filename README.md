# THE WORLD IN ONE DAY — 21 November 2026

[![make.fun · news-image-20261121](https://make.fun/badge/news-image-20261121.svg)](https://make.fun/bounty/news-image-20261121?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)
[![rank](https://make.fun/badge/news-image-20261121/Djebrix/news-image-20261121/rank.svg)](https://make.fun/bounty/news-image-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)
[![reward](https://make.fun/badge/news-image-20261121/Djebrix/news-image-20261121/reward.svg)](https://make.fun/bounty/news-image-20261121?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261121)

A newspaper front page summing up Saturday 21 November 2026 in a single image,
entered in the [make.fun news-image-20261121 bounty](https://make.fun/bounty/news-image-20261121).

The front page leads with Russia's biggest attacks of the year on Ukraine —
more than 400 drones and 110 missiles overnight, at least eight killed in Kyiv,
and two missiles and a suspected drone coming down in Poland, which Warsaw
called a deliberate provocation. It also covers the World Court ruling Myanmar
responsible for genocide against the Rohingya, the AI-driven sell-off that put
the S&P 500 in correction (Nasdaq down 5.3 percent), the COP31 climate talks
running past their deadline in Antalya over fossil fuels, and the UK and EU
signing their biggest post-Brexit agreements. The "Also Today" strip adds the
6.8 magnitude earthquake in Peru, Anthropic shares sliding after a record
$2 trillion debut, the FBI criminal database reportedly hacked, Houthi missiles
fired at Riyadh being intercepted, Denmark expelling a Russian diplomat, and
Bayer paying $7.25 billion to settle Roundup complaints.

## How it works

`main.ts` draws the whole page itself: a hand-written 5x7 bitmap font, a small
canvas library (rectangles, lines, circles), three drawn illustrations (a
stat panel of the night's barrage, scales of justice, and a bar chart of the
day's market falls), and a from-scratch PNG encoder (CRC32, zlib via Node's
standard library). No network, no clock, no randomness — the output is fully
deterministic: run it twice and the two PNGs are byte-identical.

## Run it

```sh
# Node 22+
npx tsx main.ts
# writes entry.png to $MAKEFUN_OUTPUT_DIR (default /output)
```

Verify determinism:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out-a npx tsx main.ts
MAKEFUN_OUTPUT_DIR=/tmp/out-b npx tsx main.ts
sha256sum /tmp/out-a/entry.png /tmp/out-b/entry.png  # identical hashes
```

The output is a 1024x1024 PNG, under 1 MiB.

## Sources

BBC, Reuters, AP, Horizon. Every story on the page happened
or was first reported on Saturday 21 November 2026.
