"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Download, Loader2, Youtube } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Simulate job storage for preview mode
const previewJobs = new Map<
  string,
  {
    status: "pending" | "processing" | "completed" | "failed"
    progress: number
    error?: string
    downloadUrl?: string
  }
>()

export function ReactionSplitGenerator() {
  const { toast } = useToast()
  const [isPreviewMode, setIsPreviewMode] = useState(false)

  // Check if we're in preview mode
  useEffect(() => {
    // Check if we're in a preview environment
    const isPreview =
      window.location.hostname.includes("vercel") ||
      window.location.hostname.includes("localhost") ||
      window.location.hostname.includes("vusercontent.com")

    setIsPreviewMode(isPreview)
    console.log("Preview mode:", isPreview)
  }, [])

  // State for form inputs
  const [topVideoLink, setTopVideoLink] = useState<string>("")
  const [bottomVideoLink, setBottomVideoLink] = useState<string>("")
  const [topStartTime, setTopStartTime] = useState<string>("0")
  const [bottomStartTime, setBottomStartTime] = useState<string>("0")
  const [duration, setDuration] = useState<string>("60")
  const [topVolume, setTopVolume] = useState<number>(30)
  const [bottomVolume, setBottomVolume] = useState<number>(100)

  // Job state
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<number>(0)
  const [jobError, setJobError] = useState<string>("")
  const [downloadUrl, setDownloadUrl] = useState<string>("")

  // Simulate job processing for preview mode
  const simulateJobProcessing = (jobId: string) => {
    // Initialize job
    previewJobs.set(jobId, {
      status: "pending",
      progress: 0,
    })

    // Simulate processing
    let progress = 0
    const interval = setInterval(() => {
      progress += 10

      if (progress <= 90) {
        previewJobs.set(jobId, {
          status: "processing",
          progress,
        })
      } else {
        clearInterval(interval)
        previewJobs.set(jobId, {
          status: "completed",
          progress: 100,
          downloadUrl: `https://example.com/simulated-reaction-${jobId}.mp4`,
        })

        // Create a sample file for download
        setTimeout(() => {
          const sampleFile = new Blob(["This is a sample reaction video file"], { type: "video/mp4" })
          const url = URL.createObjectURL(sampleFile)
          const a = document.createElement("a")
          a.href = url
          a.download = "sample-reaction-video.mp4"
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }, 500)
      }
    }, 200) // Speed up the simulation for better UX
  }

  // Get job status for preview mode
  const getPreviewJobStatus = (jobId: string) => {
    return previewJobs.get(jobId)
  }

  // Generate the video
  const generateVideo = async () => {
    if (!topVideoLink || !bottomVideoLink) {
      toast({
        title: "Error",
        description: "Please enter both top and bottom video URLs",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setJobStatus("pending")
    setJobProgress(0)
    setJobError("")
    setDownloadUrl("")

    try {
      // Generate a unique job ID
      const generatedJobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      if (isPreviewMode) {
        console.log("Running in preview mode - simulating API")
        // Simulate API in preview mode
        simulateJobProcessing(generatedJobId)
        setJobId(generatedJobId)

        // Start polling for simulated job status
        const statusInterval = setInterval(() => {
          const jobStatus = getPreviewJobStatus(generatedJobId)
          if (jobStatus) {
            setJobStatus(jobStatus.status)
            setJobProgress(jobStatus.progress)

            if (jobStatus.downloadUrl) {
              setDownloadUrl(jobStatus.downloadUrl)
            }

            if (jobStatus.status === "completed" || jobStatus.status === "failed") {
              clearInterval(statusInterval)
              setIsGenerating(jobStatus.status !== "failed")

              if (jobStatus.status === "completed") {
                toast({
                  title: "Success",
                  description: "Your reaction video is ready to download! (Simulated in preview mode)",
                })
              }
            }
          }
        }, 200) // Speed up the polling for better UX

        return
      }

      const response = await fetch("/api/generate-reaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topVideo: topVideoLink,
          bottomVideo: bottomVideoLink,
          topStartTime: Number.parseFloat(topStartTime),
          bottomStartTime: Number.parseFloat(bottomStartTime),
          duration: Number.parseFloat(duration),
          topVolume: topVolume / 100,
          bottomVolume: bottomVolume / 100,
        }),
      })

      // Check if the response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        // Handle non-JSON response
        const text = await response.text()
        console.error("Non-JSON response:", text.substring(0, 500))
        throw new Error(`Server returned non-JSON response (${response.status}). Falling back to preview mode.`)
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to start video generation")
      }

      const data = await response.json()
      setJobId(data.jobId)

      // Poll for job status
      const statusInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/job-status?jobId=${data.jobId}&type=reaction`)

          // Check if the status response is JSON
          const statusContentType = statusResponse.headers.get("content-type")
          if (!statusContentType || !statusContentType.includes("application/json")) {
            const text = await statusResponse.text()
            console.error("Non-JSON status response:", text.substring(0, 500))
            throw new Error(`Server returned non-JSON status response (${statusResponse.status})`)
          }

          if (!statusResponse.ok) {
            throw new Error("Failed to get job status")
          }

          const statusData = await statusResponse.json()
          setJobStatus(statusData.status)
          setJobProgress(statusData.progress || 0)

          if (statusData.error) {
            setJobError(statusData.error)
            clearInterval(statusInterval)
            setIsGenerating(false)
          }

          if (statusData.downloadUrl) {
            setDownloadUrl(statusData.downloadUrl)
          }

          if (statusData.status === "completed" || statusData.status === "failed") {
            clearInterval(statusInterval)
            setIsGenerating(statusData.status !== "failed")

            if (statusData.status === "completed") {
              toast({
                title: "Success",
                description: "Your reaction video is ready to download!",
              })

              // Trigger download if available
              if (statusData.downloadUrl) {
                const a = document.createElement("a")
                a.href = statusData.downloadUrl
                a.download = "reaction-video.mp4"
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
              }
            } else if (statusData.status === "failed") {
              toast({
                title: "Error",
                description: statusData.error || "Failed to generate video",
                variant: "destructive",
              })
            }
          }
        } catch (error) {
          clearInterval(statusInterval)
          setIsGenerating(false)
          setJobStatus("failed")
          toast({
            title: "Error",
            description: error.message || "Failed to check job status",
            variant: "destructive",
          })
        }
      }, 2000)
    } catch (error) {
      console.error("Error starting video generation:", error)

      if (isPreviewMode || error.message.includes("Falling back to preview mode")) {
        // If we're in preview mode or need to fall back to it, simulate the process
        console.log("Falling back to preview mode simulation")
        const generatedJobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        simulateJobProcessing(generatedJobId)
        setJobId(generatedJobId)

        // Start polling for simulated job status
        const statusInterval = setInterval(() => {
          const jobStatus = getPreviewJobStatus(generatedJobId)
          if (jobStatus) {
            setJobStatus(jobStatus.status)
            setJobProgress(jobStatus.progress)

            if (jobStatus.downloadUrl) {
              setDownloadUrl(jobStatus.downloadUrl)
            }

            if (jobStatus.status === "completed" || jobStatus.status === "failed") {
              clearInterval(statusInterval)
              setIsGenerating(jobStatus.status !== "failed")

              if (jobStatus.status === "completed") {
                toast({
                  title: "Success",
                  description: "Your reaction video is ready to download! (Simulated in preview mode)",
                })
              }
            }
          }
        }, 200)

        return
      }

      setIsGenerating(false)
      setJobStatus("failed")
      setJobError(error.message || "Failed to start video generation")
      toast({
        title: "Error",
        description: error.message || "Failed to start video generation",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Panel - Settings */}
      <div className="space-y-6">
        {isPreviewMode && (
          <Alert className="bg-amber-900 border-amber-700">
            <AlertTitle>Preview Mode</AlertTitle>
            <AlertDescription>
              Running in preview mode. API calls will be simulated and a sample video file will be provided for download.
            </AlertDescription>
          </Alert>
        )}

        {/* Video Sources */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Video Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-300">Top Video (Reaction)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={topVideoLink}
                  onChange={(e) => setTopVideoLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open("https://www.youtube.com", "_blank")}
                  className="border-gray-600 text-red-400 hover:text-red-300"
                >
                  <Youtube className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-gray-300">Bottom Video (Content)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  value={bottomVideoLink}
                  onChange={(e) => setBottomVideoLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open("https://www.youtube.com", "_blank")}
                  className="border-gray-600 text-red-400 hover:text-red-300"
                >
                  <Youtube className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timing Controls */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Timing Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-gray-300">Top Video Start (seconds)</Label>
                <Input
                  type="number"
                  value={topStartTime}
                  onChange={(e) => setTopStartTime(e.target.value)}
                  min="0"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300">Bottom Video Start (seconds)</Label>
                <Input
                  type="number"
                  value={bottomStartTime}
                  onChange={(e) => setBottomStartTime(e.target.value)}
                  min="0"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>

              <div>
                <Label className="text-gray-300">Duration (seconds)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  max="600"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volume Controls */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Volume Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-gray-300">
                  Top Video Volume: {topVolume}%
                </Label>
                <span className="text-xs text-gray-400">{topVolume === 0 ? "(Muted)" : ""}</span>
              </div>
              <Slider
                value={[topVolume]}
                onValueChange={(value) => setTopVolume(value[0])}
                min={0}
                max={100}
                step={5}
                className="py-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-gray-300">
                  Bottom Video Volume: {bottomVolume}%
                </Label>
                <span className="text-xs text-gray-400">{bottomVolume === 0 ? "(Muted)" : ""}</span>
              </div>
              <Slider
                value={[bottomVolume]}
                onValueChange={(value) => setBottomVolume(value[0])}
                min={0}
                max={100}
                step={5}
                className="py-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Generate Button */}
        <Button
          onClick={generateVideo}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!topVideoLink || !bottomVideoLink || isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Youtube className="mr-2 h-4 w-4" />
          )}
          {isGenerating 
            ? (isPreviewMode ? "Simulating Video Generation..." : "Generating Video...")
            : (isPreviewMode ? "Simulate Reaction Video" : "Generate Reaction Video")
          }
        </Button>

        {/* Progress and Status */}
        {isGenerating && (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Progress</span>
                  <span className="text-gray-300">{jobProgress}%</span>
                </div>
                <Progress value={jobProgress} className="w-full" />
                <p className="text-sm text-gray-400">{jobStatus}</p>
                {isPreviewMode && (
                  <p className="text-xs text-amber-400">
                    Note: This is a simulated process in preview mode.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {jobError && (
          <Alert variant="destructive" className="bg-red-900 border-red-700">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{jobError}</AlertDescription>
          </Alert>
        )}

        {/* Download Link */}
        {downloadUrl && (
          <Alert className="bg-green-900 border-green-700">
            <Download className="h-4 w-4" />
            <AlertTitle>Ready for Download</AlertTitle>
            <AlertDescription>
              <a
                href={downloadUrl}
                className="text-green-300 hover:text-green-200 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {isPreviewMode ? "Download Sample Video" : "Download Video"}
              </a>
              {isPreviewMode && (
                <p className="text-xs text-gray-400 mt-2">
                  Note: In preview mode, this will download a sample file, not an actual processed video.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Right Panel - Preview */}
      <div>
        <Card className="bg-gray-800 border-gray-700 h-full">
          <CardHeader>
            <CardTitle className="text-white">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 flex flex-col items-center justify-center">
              <div className="w-full max-w-[180px] aspect-[9/16] bg-gray-700 rounded-md overflow-hidden">
                <div className="w-full h-1/2 bg-gray-600 flex items-center justify-center text-gray-300 text-xs">
                  Top Video
                </div>
                <div className="w-full h-1/2 bg-gray-500 flex items-center justify-center text-gray-200 text-xs">
                  Bottom Video
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">9:16 Vertical Format (1080x1920)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
