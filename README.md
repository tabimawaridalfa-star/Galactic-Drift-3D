# Galactic Drift 3D

Game aksi petualangan luar angkasa 3D berbasis web yang dibangun dengan **Three.js**, **React**, dan **TypeScript**. Seluruh planet, tekstur PBR, efek atmosfer, pesawat, dan audio dihasilkan **100% secara prosedural** langsung di browser tanpa URL aset eksternal.

## Fitur Utama

- **Tata Surya Prosedural 3D**: 6 planet unik (**Terra** dengan lampu kota sisi malam & hamburan senja, **Pyros** dengan lava & bara vulkanik, **Cryos** dengan aurora kutub, **Saturnia** dengan cincin ganda & bayangan gerhana, **Rubra** berkawah dalam, serta **Aether** dengan kristal mengorbit & bulan).
- **Grafis Sinematik & Preset Kualitas**: Shader api thruster plasma volumetrik dengan *Mach shock diamonds*, post-processing `UnrealBloomPass` + MSAA, pantulan cahaya planet dinamis, *self-shadowing*, *anamorphic lens flare* matahari, serta pilihan preset **Ultra (HD)** dan **Performa**.
- **Mekanik Tempur Ace Pilot**:
  - Senjata utama 4 tingkat (hingga *Heavy Quad Plasma*) & senjata sekunder **Rudal Homing Lock-On**.
  - Manuver **Barrel Roll / Dodge** dengan *invulnerability frames*.
  - **Radar 3D Holografik**, *Ballistic Target Lead Indicator*, serta perpindahan kamera **Third-Person** & **First-Person Cockpit**.
- **Ekonomi Koin, Hangar Upgrade & Boss Fight**: Kumpulkan kristal kredit untuk meng-upgrade Senjata, Mesin, Lambung & Perisai Energi, serta Scanner di **Hangar**, lalu hadapi **Boss Dreadnought** raksasa 2 fase di orbit Aether.
- **Audio Sintetis Web Audio API**: Efek laser, rudal, lock-on, ledakan, dan musik latar adaptif prosedural.
- **Responsif Desktop & Mobile**: Dilengkapi joystick virtual & tombol aksi sentuh otomatis pada perangkat layar sentuh.

## Kontrol

| Aksi | Desktop | Mobile |
| --- | --- | --- |
| Pitch (Naik / Turun) | `W` / `S` | Joystick Virtual |
| Belok & Banking | `A` / `D` | Joystick Virtual |
| Turbo Boost | `Shift` | Tombol Boost |
| Tembak Plasma | `Spasi` / Klik Kiri | Tombol Tembak |
| Rudal Homing | `E` / Klik Kanan | Tombol Rudal |
| Barrel Roll / Dodge | `Q` atau ketuk `A`/`D` 2x | — |
| Ganti Kamera (3P / Kokpit) | `C` | Tombol Kamera |
| Buka Hangar Upgrade | `H` | Tombol Hangar |
| Suara / Jeda | `M` / `P` atau `Esc` | Tombol HUD |

## Menjalankan Secara Lokal

Pastikan **Node.js 20+** sudah terpasang.

```bash
# 1. Install dependensi
npm install

# 2. Jalankan server pengembangan (http://localhost:3000)
npm run dev

# 3. Jalankan unit test logika game
npm test

# 4. Type-check & build produksi
npm run lint
npm run build
```

## Teknologi

- [Three.js](https://threejs.org/) (WebGL2, GLSL Shaders, EffectComposer, PMREM)
- [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) & [Tailwind CSS v4](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/)
