# Results

Every result we have published. The raw logs are in [benchmarks/](../benchmarks/README.md), so you can recompute any number here. The README's charts come from the first section.

- [Live runs, six models](#live-runs-six-models)
- [Paused and Live runs, four models](#paused-and-live-runs-four-models)
- [JevBench: decisions on text](#jevbench-decisions-on-text)

## Live runs, six models

Four Live runs on 2026-10-17. Every model played the same four runs, with the same pieces, and each run stopped once four of the six boards had filled up. Laya and Strands Decider ran on our own NVIDIA A10G GPU in AWS us-east-1; every other model ran through its provider's API.

| Model | Type | On time (higher is better) | Correct (higher is better) | Decisions per run | Good-move rate (higher is better) | Time allowed per decision (median) | Typical answer time (lower is better) | Cost for 4 runs |
|---|---|---|---|---|---|---|---|---|
| Jev | decision model | 100% | 60% | 118.8 | 59% | 4.8 s | 289 ms | $0.03 |
| Cloudflare Clef | decision model | 99% | 49% | 69.8 | 48% | 7.9 s | 438 ms | $0.11 |
| GPT-6.1 Sol | language model | 87% | 64% | 26.8 | 72% | 7.6 s | 2.04 s | $0.48 |
| Claude Opus 5.5 | language model | 54% | 46% | 17.8 | 79% | 8.1 s | 5.14 s | $1.02 |
| Strands Decider | decision model | 99% | 15% | 21.3 | 15% | 10.5 s | 435 ms | self-hosted |
| Laya | decision model | 100% | 7% | 20.5 | 7% | 9.5 s | 452 ms | self-hosted |

Jev won all four runs. "Correct" is the share of decisions that were on time and the best spot; "time allowed" is how long the piece took to land (19.5 s at the start, down to 0.5 s).

The language models choose best but answer too slowly for the falling pieces. Laya and Strands Decider answer fast but choose poorly. Jev is the only model that does both.

```sh
bun bench chart benchmarks/2026-10-17/tetris --out docs/media/results
bun run stats benchmarks/2026-10-17/tetris/*.jsonl
```

## Paused and Live runs, four models

Run with `bun bench` on 2026-10-28. Each model played 3 Paused runs of 40 pieces and 3 Live runs of 2 minutes.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="media/results-2026-10-28-choices-dark.svg">
  <img alt="Good-move rate against typical answer time, one mark per model" src="media/results-2026-10-28-choices-light.svg">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="media/results-2026-10-28-decisions-dark.svg">
  <img alt="Decisions per live run: on time and correct, on time with another move, and too late" src="media/results-2026-10-28-decisions-light.svg">
</picture>

| Model | Type | Good-move rate, Paused (higher is better) | Lines in 40 pieces, Paused (higher is better) | On time, Live (higher is better) | Correct, Live (higher is better) | Decisions per Live run | Time allowed per decision, Live (median) | Typical answer time (lower is better) | Cost for 6 runs |
|---|---|---|---|---|---|---|---|---|---|
| Jev | decision model | 50% | 8.0 | 100% | 55% | 86.7 | 6.1 s | 281 ms | $0.03 |
| Claude Haiku 5.5 | language model | 54% | 12.3 | 97% | 61% | 47.7 | 6.6 s | 1.9 s | $0.07 |
| GPT-6.1 Sol | language model | 69% | 12.3 | 68% | 54% | 30.7 | 5.1 s | 2.4 s | $0.95 |
| Claude Opus 5.5 | language model | 78% | 12.7 | 54% | 46% | 23.3 | 6.5 s | 5.8 s | $3.44 |

When the game waits for them, the slower models choose better. In Live runs, more of their answers arrive after the piece has landed, so fewer of their decisions are on time.

```sh
bun bench chart benchmarks/2026-10-28/bench --out docs/media/results-2026-10-28
bun run stats benchmarks/2026-10-28/bench/*.jsonl
```

## JevBench: decisions on text

[JevBench](https://github.com/fstandhartinger/jevbench) (v1.0.0) is an independent benchmark for decision models: 231 public questions about short texts (yes or no, pick one, rate on a scale), in three levels of difficulty. It shows whether a weak Tetris score means a weak model, or only a poor fit for Tetris. Each model answered every question once, on 2026-10-17.

| Model | Accuracy (higher is better) | Easy | Original | Hard | Median time | Cost per 1,000 decisions |
|---|---|---|---|---|---|---|
| GPT-6.1 Sol | **99.6%** | 48/48 | 72/72 | 110/111 | 1.7 s | $2.12 |
| Claude Opus 5.5 | **99.6%** | 48/48 | 72/72 | 110/111 | 2.5 s | $10.01 |
| Cloudflare Clef | 87.9% | 48/48 | 71/72 | 84/111 | 393 ms | $0.17 |
| Jev | 86.1% | 48/48 | 71/72 | 80/111 | 297 ms | $0.04 |
| Strands Decider | 77.9% | 48/48 | 67/72 | 65/111 | 516 ms | self-hosted |
| Laya | 53.7% | 47/48 | 47/72 | 30/111 | 473 ms | self-hosted |

Given time, the language models answer almost everything correctly. The decision models give up some accuracy to answer in a few hundred milliseconds, which is what the falling pieces reward. Why each model scores the way it does is in [findings](findings.md).
