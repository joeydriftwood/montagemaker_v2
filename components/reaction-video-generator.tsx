"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Download, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ReactionVideoGenerator() {
  // Form state
  const [topVideo, setTopVideo] = useState("")
  const [bottomVideo, setBottomVideo] = useState("")
  const [topStartTime, setTopStartTime] = useState("0")
  const [bottomStartTime, setBottomStartTime] = useState("0")
  const [duration, setDuration] = useState("60")
  const [topVolume, setTopVolume] = useState(1)
  const [bottomVolume, setBottomVolume] = useState(1)

  // Job state
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState(0)
  const [jobError, setJobError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-convert Dropbox links
  const convertDropboxLink = (url: string) => {
    if (url.includes("dropbox.com") && !url.includes("raw=1")) {
      if (url.endsWith("dl=0")) {
        return url.slice(0, -4) + "raw=1"
      } else if (!url.includes("?")) {
        return url + "?raw=1"
      }
    }
    return url
  }

  // Handle top video URL change
  const handleTopVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTopVideo(convertDropboxLink(value))
  }

  // Handle bottom video URL change
  const handleBottomVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setBottomVideo(convertDropboxLink(value))
  }

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Reset job state
    setJobId(null)
    setJobStatus(null)
    setJobProgress(0)
    setJobError(null)
    setDownloadUrl(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/generate-reaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topVideo,
          bottomVideo,
          topStartTime,
          bottomStartTime,
          duration,
          topVolume,
          bottomVolume,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start job")
      }

      setJobId(data.jobId)
      setJobStatus("pending")
    } catch (error) {
      setJobError(error.message || "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Poll job status
  useEffect(() => {
    if (!jobId || jobStatus === "completed" || jobStatus === "failed") {
      return
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/job-status?jobId=${jobId}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to get job status")
        }

        setJobStatus(data.status)
        setJobProgress(data.progress || 0)

        if (data.error) {
          setJobError(data.error)
        }

        if (data.downloadUrl) {
          setDownloadUrl(data.downloadUrl)
        }

        // Stop polling if job is completed or failed
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(pollInterval)
        }
      } catch (error) {
        setJobError(error.message || "Failed to get job status")
        clearInterval(pollInterval)
      }
    }, 2000)

    return () => clearInterval(pollInterval)
  }, [jobId, jobStatus])

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="topVideo">Top Video URL (YouTube or Direct Link)</Label>
                <Input
                  id="topVideo"
                  value={topVideo}
                  onChange={handleTopVideoChange}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="bottomVideo">Bottom Video URL (YouTube or Direct Link)</Label>
                <Input
                  id="bottomVideo"
                  value={bottomVideo}
                  onChange={handleBottomVideoChange}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="topStartTime">Top Video Start Time (seconds)</Label>
                  <Input
                    id="topStartTime"
                    type="number"
                    min="0"
                    step="0.1"
                    value={topStartTime}
                    onChange={(e) => setTopStartTime(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="bottomStartTime">Bottom Video Start Time (seconds)</Label>
                  <Input
                    id="bottomStartTime"
                    type="number"
                    min="0"
                    step="0.1"
                    value={bottomStartTime}
                    onChange={(e) => setBottomStartTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="duration">Duration (seconds)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  max="600"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="topVolume">Top Video Volume: {topVolume.toFixed(1)}</Label>
                <Slider
                  id="topVolume"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[topVolume]}
                  onValueChange={(value) => setTopVolume(value[0])}
                />
              </div>

              <div>
                <Label htmlFor="bottomVolume">Bottom Video Volume: {bottomVolume.toFixed(1)}</Label>
                <Slider
                  id="bottomVolume"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[bottomVolume]}
                  onValueChange={(value) => setBottomVolume(value[0])}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting || jobStatus === "processing"}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : jobStatus === "processing" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Generate Reaction Video"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Job Status */}
      {jobId && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="text-lg font-medium">Job Status: {jobStatus}</h3>
              <Progress value={jobProgress} className="mt-2" />
              <p className="text-sm text-gray-500 mt-1">Progress: {jobProgress}%</p>
            </div>

            {jobError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{jobError}</AlertDescription>
              </Alert>
            )}

            {downloadUrl && (
              <div className="flex flex-col items-center space-y-2">
                <p className="text-green-600 font-medium">Your video is ready!</p>
                <Button asChild>
                  <a href={downloadUrl} download>
                    <Download className="mr-2 h-4 w-4" />
                    Download Video
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
