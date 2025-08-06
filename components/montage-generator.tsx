"use client"

import { useState, useRef } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Download, Loader2, Plus, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

export function MontageGenerator() {
  const { toast } = useToast()

  // Form state
  const [videoLinks, setVideoLinks] = useState<string[]>([""])
  const [montageType, setMontageType] = useState<string>("fixed")
  const [layoutType, setLayoutType] = useState<string>("cut")
  const [useRandomPositions, setUseRandomPositions] = useState<boolean>(false)
  const [interval, setInterval] = useState<string>("1")
  const [bpm, setBpm] = useState<string>("120")
  const [montageLength, setMontageLength] = useState<string>("30")
  const [keepAudio, setKeepAudio] = useState<boolean>(true)
  const [resolution, setResolution] = useState<string>("720p")
  const [linearMode, setLinearMode] = useState<boolean>(true)
  const [customFilename, setCustomFilename] = useState<string>("montage.mp4")
  const [startCutAt, setStartCutAt] = useState<string>("0")
  const [endCutAt, setEndCutAt] = useState<string>("60")
  const [variations, setVariations] = useState<string>("1")

  // Processing mode
  const [useCloudProcessing, setUseCloudProcessing] = useState<boolean>(false)
  const pollIntervalRef = useRef<number | null>(null)

  // Job state
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<number>(0)
  const [jobError, setJobError] = useState<string>("")
  const [downloadUrl, setDownloadUrl] = useState<string>("")

  // Add video link field
  const addVideoLink = () => {
    setVideoLinks([...videoLinks, ""])
  }

  // Remove video link field
  const removeVideoLink = (index: number) => {
    const newLinks = [...videoLinks]
    newLinks.splice(index, 1)
    if (newLinks.length === 0) {
      newLinks.push("")
    }
    setVideoLinks(newLinks)
  }

  // Update video link
  const updateVideoLink = (index: number, value: string) => {
    const newLinks = [...videoLinks]
    newLinks[index] = value
    setVideoLinks(newLinks)
  }

  // Poll job status for cloud processing
  const pollJobStatus = async (jobId: string) => {
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/job-status?jobId=${jobId}`)
        const data = await response.json()

        if (response.ok) {
          setJobProgress(data.progress)
          
          if (data.status === "completed") {
            setIsGenerating(false)
            setJobStatus("completed")
            setDownloadUrl(data.downloadUrl)
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
            toast({
              title: "Success",
              description: "Your montage is ready to download!",
            })
          } else if (data.status === "failed") {
            setIsGenerating(false)
            setJobStatus("failed")
            setJobError(data.error || "Processing failed")
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current)
              pollIntervalRef.current = null
            }
            toast({
              title: "Error",
              description: data.error || "Processing failed",
              variant: "destructive",
            })
          }
        } else {
          throw new Error(data.error || "Failed to get job status")
        }
      } catch (error) {
        console.error("Error polling job status:", error)
        setIsGenerating(false)
        setJobStatus("failed")
        setJobError("Failed to check job status")
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        toast({
          title: "Error",
          description: "Failed to check job status",
          variant: "destructive",
        })
      }
    }, 2000) // Poll every 2 seconds

    // Stop polling after 10 minutes
    setTimeout(() => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      if (jobStatus === "processing") {
        setIsGenerating(false)
        setJobStatus("failed")
        setJobError("Processing timed out")
        toast({
          title: "Error",
          description: "Processing timed out",
          variant: "destructive",
        })
      }
    }, 600000) // 10 minutes
  }

  // Generate montage on the server
  const generateMontage = async () => {
    if (videoLinks[0].trim() === "") {
      toast({
        title: "Error",
        description: "Please enter at least one video URL",
        variant: "destructive",
      })
      return
    }

    // Clear previous job state
    setIsGenerating(true)
    setJobStatus("pending")
    setJobProgress(0)
    setJobError("")
    setDownloadUrl("")

    try {
      const endpoint = useCloudProcessing ? "/api/generate-montage-cloud" : "/api/generate-montage"
      console.log(`Sending request to ${endpoint}`)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrls: videoLinks,
          montageType,
          layoutType,
          useRandomPositions,
          interval: Number.parseFloat(interval),
          bpm: Number.parseInt(bpm),
          montageLength: Number.parseInt(montageLength),
          keepAudio,
          resolution,
          linearMode,
          customFilename,
          startCutAt: Number.parseInt(startCutAt),
          endCutAt: Number.parseInt(endCutAt),
          variations: Number.parseInt(variations),
        }),
      })

      console.log("Response status:", response.status)

      // Check if the response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        // Handle non-JSON response
        const text = await response.text()
        console.error("Non-JSON response:", text.substring(0, 500))
        throw new Error(`Server returned non-JSON response (${response.status}).`)
      }

      const data = await response.json()
      console.log("Response data:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate montage")
      }

      if (useCloudProcessing) {
        // Cloud processing - start polling for job status
        setJobId(data.jobId)
        setJobStatus("processing")
        pollJobStatus(data.jobId)
      } else {
        // Local script generation - create and download the script
        setIsGenerating(false)
        setJobStatus("completed")
        toast({
          title: "Success",
          description: "Your montage script is ready to download!",
        })

        // Create and download the script file
        if (data.scriptContent) {
          const blob = new Blob([data.scriptContent], { type: 'text/plain' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = data.scriptName || "montage_script.sh"
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      }
    } catch (error) {
      console.error("Error generating montage:", error)
      setIsGenerating(false)
      setJobStatus("failed")
      const errorMessage = error instanceof Error ? error.message : String(error)
      setJobError(errorMessage || "Failed to generate montage")
      toast({
        title: "Error",
        description: errorMessage || "Failed to generate montage",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Video Sources */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Video Sources</h3>

              {videoLinks.map((link, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={link}
                    onChange={(e) => updateVideoLink(index, e.target.value)}
                    placeholder="Enter YouTube or direct video URL"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeVideoLink(index)}
                    disabled={videoLinks.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button variant="outline" onClick={addVideoLink} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Another Video
              </Button>
            </div>

            {/* Processing Mode */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Processing Mode</h3>
              <div className="flex items-center space-x-2">
                <Switch
                  id="cloud-processing"
                  checked={useCloudProcessing}
                  onCheckedChange={setUseCloudProcessing}
                />
                <Label htmlFor="cloud-processing">
                  {useCloudProcessing ? "Cloud Processing" : "Local Script Generation"}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {useCloudProcessing 
                  ? "Process videos on our servers and download the finished montage directly. Note: YouTube URLs are not supported in cloud processing."
                  : "Generate a script to download and run locally on your computer."
                }
              </p>
            </div>

            {/* Montage Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Montage Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="montageType">Montage Type</Label>
                  <Select value={montageType} onValueChange={setMontageType}>
                    <SelectTrigger id="montageType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Interval</SelectItem>
                      <SelectItem value="bpm">BPM-based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="layoutType">Layout Type</Label>
                  <Select value={layoutType} onValueChange={setLayoutType}>
                    <SelectTrigger id="layoutType">
                      <SelectValue placeholder="Select layout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cut">Cut (Sequential)</SelectItem>
                      <SelectItem value="grid">Grid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {montageType === "fixed" ? (
                  <div className="space-y-2">
                    <Label htmlFor="interval">Interval (seconds)</Label>
                    <Input
                      id="interval"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={interval}
                      onChange={(e) => setInterval(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="bpm">BPM</Label>
                    <Input
                      id="bpm"
                      type="number"
                      min="60"
                      max="240"
                      value={bpm}
                      onChange={(e) => setBpm(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="montageLength">Montage Length (seconds)</Label>
                  <Input
                    id="montageLength"
                    type="number"
                    min="1"
                    max="300"
                    value={montageLength}
                    onChange={(e) => setMontageLength(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startCutAt">Start Cut At (seconds)</Label>
                  <Input
                    id="startCutAt"
                    type="number"
                    min="0"
                    value={startCutAt}
                    onChange={(e) => setStartCutAt(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endCutAt">End Cut At (seconds)</Label>
                  <Input
                    id="endCutAt"
                    type="number"
                    min="0"
                    value={endCutAt}
                    onChange={(e) => setEndCutAt(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resolution">Resolution</Label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger id="resolution">
                      <SelectValue placeholder="Select resolution" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">Original</SelectItem>
                      <SelectItem value="1080p">1080p</SelectItem>
                      <SelectItem value="720p">720p</SelectItem>
                      <SelectItem value="480p">480p</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="variations">Number of Variations</Label>
                  <Input
                    id="variations"
                    type="number"
                    min="1"
                    max="5"
                    value={variations}
                    onChange={(e) => setVariations(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customFilename">Custom Filename</Label>
                  <Input
                    id="customFilename"
                    value={customFilename}
                    onChange={(e) => setCustomFilename(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch id="keepAudio" checked={keepAudio} onCheckedChange={setKeepAudio} />
                  <Label htmlFor="keepAudio">Keep Audio</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="linearMode" checked={linearMode} onCheckedChange={setLinearMode} />
                  <Label htmlFor="linearMode">Linear Mode</Label>
                </div>

                {layoutType === "grid" && (
                  <div className="flex items-center space-x-2">
                    <Switch id="randomPositions" checked={useRandomPositions} onCheckedChange={setUseRandomPositions} />
                    <Label htmlFor="randomPositions">Random Positions</Label>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={generateMontage}
              disabled={isGenerating || videoLinks[0].trim() === ""}
              className="w-full bg-blue-600 text-white hover:bg-blue-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Montage...
                </>
              ) : (
                "Generate Montage"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job Status */}
      {(jobId || jobError) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {jobId && (() => {
              console.log("jobProgress type:", typeof jobProgress, jobProgress)
              return (
                <div>
                  <h3 className="text-lg font-medium">Job Status: {jobStatus}</h3>
                  <Progress value={jobProgress} className="mt-2" />
                  <p className="text-sm text-gray-500 mt-1">Progress: {jobProgress}%</p>
                </div>
              )
            })()}

            {jobError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{jobError}</AlertDescription>
              </Alert>
            )}

            {downloadUrl && (
              <div className="flex flex-col items-center space-y-2">
                <p className="text-green-600 font-medium">Your montage is ready!</p>
                <Button asChild>
                  <a href={downloadUrl} download={customFilename || "montage.mp4"}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Montage
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
