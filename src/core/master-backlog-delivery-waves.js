/**
 * User delivery waves (1–10) ↔ EIR WAVE-01..10 ↔ MIB implementation waves (1–20).
 * Machine IDs (WAVE-01..10, MIB wave numbers) stay stable; display names follow user vocabulary.
 */

/** @typedef {{ wave: number, eirId: string, code: string, title: string, mibWaves: number[] }} UserDeliveryWave */

/** @type {ReadonlyArray<UserDeliveryWave>} */
export const USER_DELIVERY_WAVES = Object.freeze([
  Object.freeze({
    wave: 1,
    eirId: "WAVE-01",
    code: "FOUNDATION",
    title: "Foundation",
    mibWaves: [1, 2, 3]
  }),
  Object.freeze({
    wave: 2,
    eirId: "WAVE-02",
    code: "DATABASE",
    title: "Database",
    mibWaves: [4]
  }),
  Object.freeze({
    wave: 3,
    eirId: "WAVE-03",
    code: "BACKEND",
    title: "Backend",
    mibWaves: [5]
  }),
  Object.freeze({
    wave: 4,
    eirId: "WAVE-04",
    code: "ANDROID",
    title: "Android",
    mibWaves: [6]
  }),
  Object.freeze({
    wave: 5,
    eirId: "WAVE-05",
    code: "WEB",
    title: "Web",
    mibWaves: [7, 8, 9]
  }),
  Object.freeze({
    wave: 6,
    eirId: "WAVE-06",
    code: "WINDOWS",
    title: "Windows",
    mibWaves: [10]
  }),
  Object.freeze({
    wave: 7,
    eirId: "WAVE-07",
    code: "AI_ANALYTICS",
    title: "AI & Analytics",
    mibWaves: [11, 12, 13, 17]
  }),
  Object.freeze({
    wave: 8,
    eirId: "WAVE-08",
    code: "TESTING",
    title: "Testing",
    mibWaves: [18]
  }),
  Object.freeze({
    wave: 9,
    eirId: "WAVE-09",
    code: "PILOT",
    title: "Pilot",
    mibWaves: [14, 15, 16]
  }),
  Object.freeze({
    wave: 10,
    eirId: "WAVE-10",
    code: "PRODUCTION",
    title: "Production",
    mibWaves: [19, 20]
  })
]);

/** MIB implementation-order wave → user delivery wave number */
export const MIB_WAVE_TO_USER_DELIVERY = Object.freeze(
  Object.fromEntries(
    USER_DELIVERY_WAVES.flatMap((u) => u.mibWaves.map((m) => [m, u.wave]))
  )
);

export function getUserDeliveryWave(waveNumber) {
  return USER_DELIVERY_WAVES.find((w) => w.wave === waveNumber) || null;
}

export function listUserDeliveryWaves() {
  return USER_DELIVERY_WAVES;
}

/**
 * Resolve user delivery wave from MIB wave number (1–20).
 * @param {number|null|undefined} mibWave
 * @returns {number|null}
 */
export function resolveUserDeliveryWave(mibWave) {
  if (mibWave == null) return null;
  return MIB_WAVE_TO_USER_DELIVERY[mibWave] ?? null;
}

export function userDeliveryWaveLabel(waveNumber) {
  const w = getUserDeliveryWave(waveNumber);
  return w ? `Wave ${w.wave} ${w.title}` : null;
}
