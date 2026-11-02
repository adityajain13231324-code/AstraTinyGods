# Test guide

Run `npm test`, `npm run build`, and `npm run simulate -- --matches 1000 --bots mixed --seed 1`.

| Milestone | Manual check |
| --- | --- |
| M0 | Open the landing screen. Confirm 60 villagers across five groups and six labelled locations. Inspect a villager. Measure FPS on the target laptop. |
| M1 | Start solo, issue each verb across several turns, let the timer expire, change speed and finish a match. |
| M2 | Enable sound. Compare a peaceful street with a fight. Select a villager and observe relationship lines, particles, expressions and the incident wire. |
| M3 | Select a recap headline to replay it. Guess a culprit. At match end compare the recorded orders with The Truth. Try a rematch and copy the story. |
| M4 | From separate networks create and join a room, mark ready, start, submit private orders, finish and rematch. Disconnect a guest and verify bot takeover. |
| M5 | Try every trait and rumor. When eliminated, submit a free whisper and vote for a highlight. Check turn-seven tension and turn-nine resolution. |
| M6 | Test sound, muted play, phone portrait, a short laptop screen, touch inspection, and room failure recovery. |

## Seeded balance run

1,000 mixed-personality matches starting at seed 1 averaged 7.856 turns. Seat win rates were 23.7%, 24.5%, 25.8%, and 26.0%. A faction was wiped out before turn three in 5% of matches. The first kill averaged turn 1.369. Matches decided by turn three accounted for 0.9%. The first victim’s faction won 3.854% of eligible matches. The mean peak living-count gap was 11.792 villagers.

Mean deaths by turn, counting only matches that reached the turn, were 1.215, 7.841, 16.840, 8.367, 3.590, 2.272, 2.800, 2.245 and 1.206.

Browser checks covered a full solo match and rematch, two local hotseat submissions, and a full host/guest match across two Chrome tabs using public signaling. A 390 px viewport had no horizontal overflow. Different-network play and target-laptop FPS still need owner-device checks.
