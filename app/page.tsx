"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimeInput(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

function toMinSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseMinSec(value: string): number | null {
  const match = value.match(/^(\d+):(\d{1,2})$/);
  if (!match) return null;
  const m = parseInt(match[1], 10);
  const s = parseInt(match[2], 10);
  if (s >= 60) return null;
  return m * 60 + s;
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.substring(dot) : ".mp4";
}

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [loadingFFmpeg, setLoadingFFmpeg] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const draggingRef = useRef<"start" | "end" | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const loadFFmpeg = useCallback(async () => {
    setLoadingFFmpeg(true);
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;
    ffmpeg.on("log", ({ message }) => {
      setProgress(message);
    });
    ffmpeg.on("progress", ({ progress: p }) => {
      setProgressPercent(Math.round(p * 100));
    });

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
    setLoaded(true);
    setLoadingFFmpeg(false);
  }, []);

  useEffect(() => {
    loadFFmpeg();
  }, [loadFFmpeg]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoUrl) URL.revokeObjectURL(videoUrl);

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setStartTime(0);
    setEndTime(0);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setEndTime(video.duration);
  };

  const handleTimelineMouseDown = (
    e: React.MouseEvent,
    handle: "start" | "end"
  ) => {
    e.preventDefault();
    draggingRef.current = handle;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current || !timelineRef.current || !duration) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      const time = ratio * duration;

      if (draggingRef.current === "start") {
        setStartTime(Math.min(time, endTime - 0.1));
      } else {
        setEndTime(Math.max(time, startTime + 0.1));
      }
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [duration, startTime, endTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && draggingRef.current === "start") {
      video.currentTime = startTime;
    }
  }, [startTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && draggingRef.current === "end") {
      video.currentTime = endTime;
    }
  }, [endTime]);

  const handleCrop = async () => {
    if (!videoFile || !loaded || !ffmpegRef.current) return;

    setProcessing(true);
    setProgress("Starting...");
    setProgressPercent(0);

    try {
      const ffmpeg = ffmpegRef.current;
      const inputName = "input" + getExtension(videoFile.name);
      const outputName = "output" + getExtension(videoFile.name);

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      // Generate watermark PNGs via canvas
      // Bottom-right: FlipTop Clips
      const canvasRight = document.createElement("canvas");
      canvasRight.width = 250;
      canvasRight.height = 40;
      const ctxRight = canvasRight.getContext("2d")!;
      ctxRight.clearRect(0, 0, canvasRight.width, canvasRight.height);
      ctxRight.font = "bold 22px Arial, sans-serif";
      ctxRight.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctxRight.textAlign = "right";
      ctxRight.textBaseline = "bottom";
      ctxRight.fillText("FlipTop Clips", 240, 35);
      const rightBlob = await new Promise<Blob>((resolve) =>
        canvasRight.toBlob((b) => resolve(b!), "image/png")
      );
      await ffmpeg.writeFile(
        "watermark_right.png",
        new Uint8Array(await rightBlob.arrayBuffer())
      );

      // Bottom-left: Like our videos / Follow our page
      const canvasLeft = document.createElement("canvas");
      canvasLeft.width = 280;
      canvasLeft.height = 60;
      const ctxLeft = canvasLeft.getContext("2d")!;
      ctxLeft.clearRect(0, 0, canvasLeft.width, canvasLeft.height);
      ctxLeft.font = "bold 18px Arial, sans-serif";
      ctxLeft.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctxLeft.textAlign = "left";
      ctxLeft.textBaseline = "bottom";
      ctxLeft.fillText("Like our videos", 10, 28);
      ctxLeft.fillText("Follow our page", 10, 52);
      const leftBlob = await new Promise<Blob>((resolve) =>
        canvasLeft.toBlob((b) => resolve(b!), "image/png")
      );
      await ffmpeg.writeFile(
        "watermark_left.png",
        new Uint8Array(await leftBlob.arrayBuffer())
      );

      const cropDuration = endTime - startTime;
      await ffmpeg.exec([
        "-ss",
        startTime.toFixed(3),
        "-i",
        inputName,
        "-i",
        "watermark_right.png",
        "-i",
        "watermark_left.png",
        "-t",
        cropDuration.toFixed(3),
        "-filter_complex",
        "[0][1]overlay=W-w-20:H-h-20[tmp];[tmp][2]overlay=20:H-h-20",
        "-avoid_negative_ts",
        "make_zero",
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName) as Uint8Array;
      const blob = new Blob([new Uint8Array(data)], { type: videoFile.type || "video/mp4" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `cropped_${videoFile.name}`;
      a.click();

      URL.revokeObjectURL(url);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      await ffmpeg.deleteFile("watermark_right.png");
      await ffmpeg.deleteFile("watermark_left.png");

      setProgress("Done!");
    } catch (err) {
      setProgress(`Error: ${err}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-8 gap-8">
      <h1 className="text-3xl font-bold">Video Cropper</h1>
      <p className="text-foreground/60">
        Upload a video, select start and end times, then download the trimmed
        clip.
      </p>

      {loadingFFmpeg && (
        <div className="w-full max-w-md flex flex-col gap-2">
          <span className="text-sm text-foreground/60">Loading FFmpeg...</span>
          <div className="w-full h-2 bg-foreground/10 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse transition-all" style={{ width: "100%" }} />
          </div>
        </div>
      )}

      <label className="cursor-pointer border-2 border-dashed border-foreground/20 rounded-xl px-12 py-8 hover:border-foreground/40 transition-colors text-center">
        <span className="block text-lg font-medium">
          {videoFile ? videoFile.name : "Click to select a video file"}
        </span>
        <span className="block text-sm text-foreground/50 mt-1">
          MP4, WebM, MOV, AVI supported
        </span>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {videoUrl && (
        <div className="w-full max-w-3xl flex flex-col gap-6">
          <video
            ref={videoRef}
            src={videoUrl}
            onLoadedMetadata={handleLoadedMetadata}
            controls
            className="w-full rounded-lg bg-black"
          />

          {duration > 0 && (
            <>
              {/* Timeline scrubber */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm text-foreground/60">
                  <span>Start: {formatTimeInput(startTime)}</span>
                  <span>Duration: {formatTimeInput(endTime - startTime)}</span>
                  <span>End: {formatTimeInput(endTime)}</span>
                </div>

                <div
                  ref={timelineRef}
                  className="relative h-12 bg-foreground/10 rounded-lg select-none"
                >
                  {/* Selected range */}
                  <div
                    className="absolute top-0 h-full bg-blue-500/30 rounded"
                    style={{
                      left: `${(startTime / duration) * 100}%`,
                      width: `${((endTime - startTime) / duration) * 100}%`,
                    }}
                  />

                  {/* Start handle */}
                  <div
                    className="absolute top-0 h-full w-3 bg-green-500 rounded cursor-col-resize hover:bg-green-400 transition-colors z-10"
                    style={{
                      left: `calc(${(startTime / duration) * 100}% - 6px)`,
                    }}
                    onMouseDown={(e) => handleTimelineMouseDown(e, "start")}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap bg-green-500 text-white px-1.5 py-0.5 rounded">
                      {formatTime(startTime)}
                    </div>
                  </div>

                  {/* End handle */}
                  <div
                    className="absolute top-0 h-full w-3 bg-red-500 rounded cursor-col-resize hover:bg-red-400 transition-colors z-10"
                    style={{
                      left: `calc(${(endTime / duration) * 100}% - 6px)`,
                    }}
                    onMouseDown={(e) => handleTimelineMouseDown(e, "end")}
                  >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap bg-red-500 text-white px-1.5 py-0.5 rounded">
                      {formatTime(endTime)}
                    </div>
                  </div>

                  {/* Time markers */}
                  <div className="absolute bottom-0 w-full flex justify-between px-1 text-[10px] text-foreground/40">
                    {Array.from({ length: 11 }, (_, i) => (
                      <span key={i}>
                        {formatTime((duration * i) / 10)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Manual input */}
              <div className="flex gap-4 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-foreground/60">
                    Start (m:ss)
                  </label>
                  <input
                    type="text"
                    placeholder="0:00"
                    defaultValue={toMinSec(startTime)}
                    key={`start-${Math.floor(startTime)}-${draggingRef.current}`}
                    onBlur={(e) => {
                      const parsed = parseMinSec(e.target.value);
                      if (parsed !== null) {
                        setStartTime(Math.max(0, Math.min(parsed, endTime - 1)));
                      } else {
                        e.target.value = toMinSec(startTime);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="border border-foreground/20 rounded px-3 py-2 bg-background w-32"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm text-foreground/60">
                    End (m:ss)
                  </label>
                  <input
                    type="text"
                    placeholder="0:00"
                    defaultValue={toMinSec(endTime)}
                    key={`end-${Math.floor(endTime)}-${draggingRef.current}`}
                    onBlur={(e) => {
                      const parsed = parseMinSec(e.target.value);
                      if (parsed !== null) {
                        setEndTime(Math.max(startTime + 1, Math.min(parsed, duration)));
                      } else {
                        e.target.value = toMinSec(endTime);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="border border-foreground/20 rounded px-3 py-2 bg-background w-32"
                  />
                </div>
                <button
                  onClick={handleCrop}
                  disabled={processing || !loaded}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2 rounded transition-colors"
                >
                  {processing ? "Processing..." : "Crop & Download"}
                </button>
              </div>

              {processing && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm text-foreground/60">
                    <span>Processing...</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-foreground/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="text-xs text-foreground/40 font-mono truncate">
                    {progress}
                  </div>
                </div>
              )}
              {!processing && progress === "Done!" && (
                <div className="text-sm text-green-500 font-medium">
                  Done! Your file has been downloaded.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
