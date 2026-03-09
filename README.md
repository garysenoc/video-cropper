# Video Cropper

A browser-based video cropping tool built with Next.js, React, and FFmpeg WebAssembly. Trim videos to specific time ranges and add watermarks — all client-side with no server processing required.

## Features

- **Video Upload** — Supports MP4, WebM, MOV, and AVI formats
- **Interactive Timeline** — Drag start/end handles on a visual timeline to select the crop range
- **Manual Time Input** — Enter precise start and end times in `m:ss` format
- **Video Preview** — Built-in HTML5 video player for previewing before cropping
- **Watermark Overlay** — Automatically adds "FlipTop Clips" and "Like our videos / Follow our page" watermarks
- **Progress Tracking** — Real-time progress bar and log messages during processing
- **Automatic Download** — Cropped video downloads automatically upon completion
- **Fully Client-Side** — All video processing runs in the browser via FFmpeg WebAssembly

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js](https://nextjs.org) 16 | React framework |
| [React](https://react.dev) 19 | UI library |
| [TypeScript](https://www.typescriptlang.org) 5 | Type safety |
| [Tailwind CSS](https://tailwindcss.com) 4 | Styling |
| [@ffmpeg/ffmpeg](https://ffmpegwasm.netlify.app) | Client-side video processing (WebAssembly) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd crop-video

# Install dependencies
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## How It Works

1. **Upload** — Select a video file from your device
2. **Select Range** — Use the interactive timeline scrubber or type exact times to set start and end points
3. **Crop & Download** — Click the button to process the video; FFmpeg trims the clip and applies watermarks
4. **Download** — The cropped video automatically downloads as `cropped_[original_name]`

### Architecture

```
app/
├── layout.tsx       # Root layout with metadata and fonts
├── page.tsx         # Main video cropper page (single-page app)
└── globals.css      # Global styles and Tailwind theme
```

The app is a single-page application. All logic — file handling, timeline interaction, FFmpeg processing, watermark generation (via Canvas API), and download — lives in `app/page.tsx`.

FFmpeg loads its WebAssembly core from a CDN at runtime and processes videos entirely in the browser using a virtual filesystem.

## Project Structure

```
crop-video/
├── app/
│   ├── layout.tsx          # Root layout, metadata, fonts
│   ├── page.tsx            # Main cropper component (~440 lines)
│   └── globals.css         # Tailwind imports and theme
├── public/                 # Static assets
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript config
├── next.config.ts          # Next.js config
├── postcss.config.mjs      # PostCSS / Tailwind config
├── eslint.config.mjs       # ESLint config
└── README.md
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm start` | Run production server |
| `npm run lint` | Run ESLint |

## License

This project is private.
