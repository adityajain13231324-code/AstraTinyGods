# Design decisions

- All four factions participate in every match. Empty seats use selectable bot personalities. Local play supports one player or two to four people passing one screen.
- Commands and rumors share a 50-second planning window. A round starts early when all orders are sealed. The host can fast-forward the simulation and advance the recap.
- The first two turns scale attack damage to preserve the peaceful opening. Strong opinions and witness backlash can still cause early casualties.
- Only an attributable highlight creates a guess question. Witness-driven violence can be unclaimed. The origin stays on the host until the final reveal.
- Clips store sampled simulation positions from the actual turn. The host sends clipped frames at recap only.
- The town is open ground. Buildings and trees are illustrated map symbols, so ranged attacks need no wall collision checks.
- Audio is original procedural synthesis. The public PeerJS service provides signaling. The host owns the room and must stay connected.
