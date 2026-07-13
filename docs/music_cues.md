Shared sound effects
These should be produced first because multiple cards and systems reuse them.
Group	Custom sounds needed
UI	Button confirm, card pickup, card drop-valid, drop-invalid, card add, card remove, menu open/close, upgrade purchased, upgrade rejected
Match	Match launch, round start, countdown pulse, pause, resume, Power Drain warning, Power Drain pulse, round victory/loss, final victory/defeat/draw
Bullet weapons	Light shot, heavy shot, sentry burst, pulse shot, bullet impact on armor, bullet impact on shield
Rocket weapons	Launch, flight tail, small impact, heavy impact, splash impact
Flame weapon	Ignition, firing loop, shutdown, thermal impact
Electrical	Arc charge, electrical impact, chain/splash, disabled electronics loop, system recovery
Healing/shields	Repair beam, healing pulse, shield activation, shield impact, shield break, damage-reduction ping
Movement	Light robot steps, heavy robot steps, servo movement, hover loop, dash/teleport
Destruction	Small robot, heavy robot, flying crash, installation collapse, Relay destroyed, Core destroyed
Towers	Relay gun, Relay rockets, Relay flame, Core rocket, tower damage alarm, friendly/enemy tower-destruction alerts
Rewards	XP awarded, level-up, cache reveal, fragments awarded, card unlocked, mastery upgrade

The existing event mapping is documented in [soundDesign.ts (line 79)](/Users/colin/Documents/Crash Roboto/src/audio/soundDesign.ts:79).
Card-specific audio
Each playable card should have an identity/select cue. Units and the Commander should additionally have 2–3 selection voice variations and 2 deploy variations.
Card	Custom sounds needed
Bolt Hound / ZIP	Robotic bark/chirp, fast deploy, light servo sprint, rapid close-range shots
Microbit Swarm	Layered digital chatter, swarm deployment burst, multiple small attacks, swarm collapse
Titan-0 / BRUTE	Deep voice, heavy landing, armored footsteps, heavy rocket launch and impact
Rail Strider	Target-lock voice, hydraulic deployment, siege weapon charge, long-range launch and heavy impact
Pulse Ranger	Clean tactical voice, deploy pulse, tracking servo, distinctive pulse-rifle shot and impact
Arc Crawler	Crackling voice, electrical boot, arc weapon charge, primary blast, chained splash discharge
Jet Drone	Filtered airborne voice, liftoff, hover loop, aerial rocket launch, damaged flight and crash
Patch Bot	Friendly diagnostic voice, deploy, repair-beam start/loop/end, repair completion, defensive shot
VECTOR-9	Commander voice set, authoritative deployment, commander weapon, Overdrive activation, aura loop and expiration
AEGIS-4	Defensive voice, heavy deployment, Barrier Boot activation, shield hit variations, shield break, normal weapon
Wraith Coil	Distorted voice, phase deployment, Phase Step departure/arrival, phase attack, destabilized destruction
Scrap Viper	Aggressive voice, deploy, claw/weapon strike, Salvage Siphon, self-repair confirmation
EMP Flash	Card-selection cue, targeting charge, EMP detonation, electronics shutdown, disabled loop, recovery spark
Nano Cloud	Card-selection cue, canister/cloud release, corrosive loop, damage ticks, field dissipation
Gravity Well	Card-selection cue, singularity charge, implosion, pull sweep, slowed-cycle ambience, collapse
Arc Sentry	Card-selection cue, placement clamp, boot-up, rotating servo, sentry gun variations, timeout shutdown
Microbot Foundry	Card-selection cue, heavy placement, machinery startup, production loop, paired microbot release, shutdown
Firewall Node	Card-selection cue, placement, matrix expansion, persistent aura hum, protected-hit ping, expiration/collapse

The Foundry-generated Microbots also need a small spawn chirp, lightweight movement, attack, and destruction sound, even though they are not a playable card.
Music triggers
Two tracks already exist in [musicCatalog.ts (line 22)](/Users/colin/Documents/Crash Roboto/src/audio/musicCatalog.ts:22):
Lobby entrance/loop
Main battle track
Recommended custom music package:
Trigger	Music required	Behavior
App launch or return to lobby	Lobby loop — exists	Start from beginning and loop seamlessly
Deploy Loadout	Deployment transition stinger	Bridge lobby music into battle
Match/round starts	Battle opening	Brief intro leading into the main loop
Opening stage	Opening battle layer	Energetic but restrained first 15 seconds
Relay War stage	Main battle loop — exists	Default combat music
Core Surge	High-intensity battle loop	Trigger when Charge doubles near match end
Friendly Relay destroyed	Danger stinger	Duck music briefly, then resume
Enemy Relay destroyed	Advantage stinger	Short upward musical hit
Friendly Core critical	Critical-health layer	Add urgency without replacing combat clarity
Overdrive activated	Overdrive layer/stinger	Short synchronized power-up accent
Power Drain begins	Power Drain cue/loop	Replace or heavily duck battle music
Round victory/loss	Two short round stingers	Needed for Best of Three
Final victory	Victory theme	Play after battle music stops
Final defeat	Defeat theme	Dark result sting or short theme
Draw	Neutral result sting	Unresolved cadence
Pause	No new track	Pause all music immediately
Resume	Existing active track	Continue from paused position
Return to lobby	Lobby loop — exists	Stop result/battle audio and restart lobby track

Core Surge currently exists as game state but is not connected to music transitions, so that trigger will require a small code hook. Likewise, shield impacts, Nano ticks, Foundry spawns, lifesteal, and several ability expirations need new dedicated audio events—the current generic impact event intentionally produces no sound.
Recommended production order
Shared UI, weapons, impacts, destruction, towers, and match-result sounds.
EMP, Nano, Gravity, Sentry, Foundry, Firewall, and signature unit abilities.
Card identity voices/chirps.
Core Surge, Power Drain, victory, defeat, and round-result music.
Movement loops, ambience, and secondary variations to reduce repetition.
