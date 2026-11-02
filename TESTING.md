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

1,000 mixed-personality matches starting at seed 1 averaged 7.785 turns. Seat win rates were 24.4%, 25.4%, 26.0%, and 24.2%. A faction was wiped out before turn three in 5.3% of matches. The first kill averaged turn 1.346. Matches decided by turn three accounted for 1.3%. The first victim’s faction won 3.633% of eligible matches. The mean peak living-count gap was 11.855 villagers.

Mean deaths by turn, counting only matches that reached the turn, were 1.238, 7.780, 16.730, 8.354, 3.880, 2.576, 2.943, 2.232 and 1.302.

Browser checks covered a full solo match and rematch, two local hotseat submissions, and a full host/guest match across two Chrome tabs using public signaling. A 390 px viewport had no horizontal overflow. Different-network play and target-laptop FPS still need owner-device checks.

The field-camera playtest followed a named villager to the Well, switched observers, saw arrivals counted during the turn, and verified 12 distinct arrivals in the recap. A regression test checks that a rival cannot see this private tally.
