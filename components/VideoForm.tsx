'use client';
import { useState } from "react";

export default function VideoForm() {
  const [inputUrl, setInputUrl] = useState("");
  const [finalUrl, setFinalUrl] = useState("");

  function isYouTubeOrTikTok(url: string) {
    return /youtube\.com|youtu\.be|tiktok\.com/.test(url);
  }

  async function handleGenerate() {
    const shouldDownload = isYouTubeOrTikTok(inputUrl);

    const resolvedUrl = shouldDownload
      ? await fetch("https://montagemaker-downloader.onrender.com/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: inputUrl }),
        }).then((res) => res.json()).then((data) => data.file)
      : inputUrl;

    console.log("Final video URL:", resolvedUrl);
    setFinalUrl(resolvedUrl);

    // TODO: Pass `resolvedUrl` into your montage generator
  }

  return (
    <div>
      <input
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
        placeholder="Paste YouTube, TikTok, or Dropbox URL"
        className="border p-2 w-full"
      />
      <button onClick={handleGenerate} className="bg-black text-white px-4 py-2 mt-2">
        Generate Montage
      </button>

      {finalUrl && (
        <div className="mt-4">
          <p>Final URL:</p>
          <a href={finalUrl} target="_blank" className="text-blue-500 underline">{finalUrl}</a>
        </div>
      )}
    </div>
  );
}