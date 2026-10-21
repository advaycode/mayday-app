# Breathing from the phone's tilt: research notes

October 21, 2026. Background for `mobile/src/sensors/` (the breathing check and the practice lab). Sources were read through search results and the two Landreani PDFs; anything taken from a search summary rather than the paper itself is marked *(summary)*.

## The idea

Lay the phone on its back along the torso: top end on the chest, bottom end on the belly. Breathing lifts the two ends by different amounts, so the phone tips by a degree or two with every breath. The accelerometer sees that tilt the same way the iPhone's Level does, as gravity shifting between the phone's long axis and its face, and it resolves it to about a hundredth of a degree.

```
pitch = atan2(y, z)    head-to-foot tilt: the breathing signal
roll  = atan2(x, z)    side to side
|a| - g                up-and-down motion of the whole phone (tilt does not change |a|)
```

## What was found

**The iPhone Level.** Measure app → Level. Lying flat, two circles meet and the screen turns green at 0°. Tap to capture the current angle as the reference, then it reads relative to that; tap again to reset. It uses the accelerometer. Mayday does the same: one still second after the phone is laid down becomes zero ("leveling"), and tapping the dial in the lab levels again. Mayday shows hundredths of a degree and magnifies the moving circle 40 times, because a breath is about 1-2°.
- Apple, iPhone User Guide, "Use the Level" (the page found is the iOS 12 edition): https://support.apple.com/en-asia/guide/iphone/use-the-level-iphbd435673d/12.0/ios
- iPhone Life, the Level uses the accelerometer *(summary)*: https://iphonelife.com/content/your-iphone-has-free-level-app-heres-how-to-find-use-it

**Breathing from a phone on the chest works, in small studies.** Landreani et al. (Computing in Cardiology 2017): iPhone 4s and 6s at about 100 samples a second, one on the sternum and one on the belly, 10 supine volunteers (9 analysed), paced breathing at 0.25, 0.17, 0.125 and 0.1 Hz for 12 cycles each. The breathing was "mainly visible along the longitudinal (Y-axis)", which is exactly the tilt above. 4th-order Butterworth low-pass at 0.5 Hz, valleys detected, error under 2% at every rate, best on the belly.
- https://re.public.polimi.it/bitstream/11311/1045105/1/137-402_Landreani.pdf

Others, *(summary)*: Nayak and Bolic (IEEE Open Journal of Instrumentation and Measurement, 2024, DOI 10.1109/OJIM.2024.3477572), an unattached phone on the chest of a supine person, breathing and heart rate together, checked against a breathing belt and ECG: https://doaj.org/article/94d60317e3494086ad7a91420b8d5bba. Cinotti et al. (Sensors, 2025), 10 subjects at rest, breathing acts detected with sensitivity 95.6% and PPV 94.7%: https://doaj.org/article/69a76d01586247d79ffaa80b19bcc6d9. Estrada et al. (UPC), 5 subjects, phone z-axis vs airflow, r = 0.98: https://www.recercat.cat/handle/2072/308470.

**The heartbeat as a vibration (seismocardiography).** Landreani et al. (IEEE EMBC 2016): iPhone 6 at 100 samples a second, resolution 0.001 g, 9 healthy men, supine and standing, phone along the midclavicular line, top toward the head, so X = left-right, Y = head-foot, Z = front-back. Front-back component band-passed 5-25 Hz (Butterworth); beats found by full-wave rectification, a threshold at half the mean peak height, suppressing smaller peaks within 50 ms, then a template cross-correlation check. Over 98% of beats found supine, beat-to-beat intervals correlated above 0.98 with ECG. Mayday follows these steps (`sensors/heart.ts`), with an autocorrelation for the rate.
- https://re.public.polimi.it/bitstream/11311/1012505/2/EMBC16_EMBC2016_DEF_afterreview_Federica.pdf
- Follow-up, three axes, 11 men, sensitivity 0.995, PPV 0.974 *(summary)*: https://re.public.polimi.it/retrieve/e0c31c0f-3332-4599-e053-1705fe0aef77/CinC2018-215_Landreani.pdf

**How far the chest and belly move.** Quiet breathing, supine, 9 healthy young men: chest 2-4 mm, abdomen 7-9 mm per breath; supine moves less than sitting *(summary; full text not read)*: https://osu.repo.nii.ac.jp/records/489. With the phone's ends about 140 mm apart, a 4-5 mm difference is 1.6-2°.

**Sensor noise.** Apple does not publish the iPhone accelerometer's noise. A typical phone-class part, the Bosch BMI160, lists 180 µg/√Hz *(product page)*: https://www.bosch-sensortec.com/bst/products/all_products/bmi160. At 100 samples a second that is about 1.3 mg per sample, or 0.01° of tilt after filtering to the breathing band. The simulator uses 180 µg/√Hz and sweeps up to 8 times that.

**Browsers.** `DeviceMotionEvent.requestPermission()` on iOS must be called inside a tap, or it is refused *(MDN, forum report)*: https://developer.mozilla.org/docs/Web/API/DeviceMotionEvent. The sample rate Safari delivers on an iPhone was not found published; the simulator assumes 60 a second for the web build. **Measure it on the phone.**

**Gasping, and why the phone must never reassure.** Agonal (gasping) breathing occurs in a large share of witnessed cardiac arrests, about 55% in Eisenberg's review *(summary)*: https://www.ehsf.org/sites/default/files/node/resource/field_resource_attachments/2017-05/Incidence%20of%20agonal%20respirations%20in%20cardiac%20arrest.pdf. Dispatchers withheld CPR instructions in 20% of arrests because the caller reported signs of life, typically abnormal breathing *(summary)*. No published rate of gasps per minute was found; the simulator uses one every 4-15 s (an assumption).

Resuscitation Council UK, 2025 adult BLS: "other abnormal patterns such as agonal gasping or panting, must be recognised as signs of cardiac arrest"; "If there is any doubt, assume cardiac arrest and start CPR"; "Lay people should start CPR for presumed cardiac arrest without concerns about harm to people not in cardiac arrest." https://www.resus.org.uk/professional-library/2025-resuscitation-guidelines/adult-basic-life-support-guidelines

## Design rules that follow

1. **The phone can only push toward CPR.** "No breathing seen" and "not normal" say *Start CPR*. Chest movement says "Chest moving, N a minute. Normal breathing, or gasping?" and shows both answers: the rescuer decides. Movement is not air: gasps and a blocked airway move the chest too. Enforced by `suggestAnswer` and a test.
2. **Ten seconds.** The check is a 10-second window after the phone is still and leveled, so it replaces watching the chest instead of adding to it.
3. **Not on babies.** A phone is too heavy and too long for an infant's chest; the infant protocol has no phone check.
4. **The heartbeat stays in the lab.** Lay rescuers are taught not to check a pulse. A phone that "finds" a heartbeat in someone in cardiac arrest could cost them their life, so the heartbeat is never shown during an emergency and never decides anything.
5. **Chest-belly sync stays out of the emergency check.** The simulator showed it is fooled by an ordinary accelerometer offset (see below).

## What the simulator showed (full tables: `docs/SENSOR_SIM.md`)

The simulator is in `mobile/src/sensors/sim.ts`: chest and belly heights, phone geometry, heartbeat vibration, a rescuer's hand, footsteps, accelerometer noise, 1 mg steps, fixed offsets, late and dropped samples. It found six real problems before any person was involved:

- **The filter's edges invented breaths.** Anchoring the zero-phase filter on a single noisy sample at the start of the window turned a 0.07° blip into a 0.2° swing; a still chest was called "breathing" in the 30-second lab. Fixed by anchoring on a short average and filtering with the second before the window.
- **The noise floor read 25% low,** because putting jittery samples on a regular clock smooths the high frequencies it was measured at. Now measured at 2-6 Hz.
- **A noisier phone looked permanently "held".** The hand detector's fixed 3 mg threshold was crossed by sensor noise alone at 4 times the noise. Now the 6-12 Hz shake is judged against the same sensor's own noise.
- **Then the hand hid itself.** Measuring that noise just below the tremor (2-5 Hz, then 1.5-4 Hz) let the hand's own shake and sway leak in, so a hand raised its own noise floor and went unnoticed in up to 60% of runs. The noise is now measured near the top of the sensor's range, side to side, where neither a hand nor a heartbeat reaches: 30 of 30 hands caught.
- **At high noise, gasps could look regular,** because noise hid the stillness between them. Stillness is now judged against the noise, and regular breathing must also keep even timing and depth. Gasping is now never called regular at any noise level tested.
- **See-saw breathing cannot be trusted without calibration.** In see-saw (blocked airway) breathing the belly rises as the chest sinks, so the phone tips a lot but barely moves up and down. The ratio detects it perfectly with no sensor offset and 98% with offsets under 5 mg, but only about 65% with offsets up to 20 mg, because the offset leaks into |a| in step with the tilt. It stays experimental, in the lab.

Known limits: if the chest and belly happen to rise by the same amount, the phone does not tip and the check says "no breathing seen" (the safe direction). Footsteps nearby look like a heartbeat about 40% of the time. A weak heartbeat (3 mg) is never found.

## Testing it on real people (to do)

On yourself, lying on the floor, phone on your chest as shown, in the Learn tab's Breathing sensor:
1. Breathe normally for a minute while a friend counts your breaths. Compare the rate.
2. Hold your breath for 15 seconds during the emergency check: it should say "No breathing seen".
3. Fake gasps: one sharp breath every 8 seconds, still in between: it should say "Not normal breathing".
4. Rest a hand on the phone: it should say "Let go of the phone".
5. Have someone walk around you. Then lie on a bed instead of the floor. Then over a jacket.
6. Note the samples per second shown on the lab screen (the "·/s" figure).

Write the results in `docs/PROGRESS.md`. Do not test on anyone who is unwell, and never in a real emergency instead of watching the chest.
