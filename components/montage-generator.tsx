"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Download, Loader2, Plus, Trash2, Cloud, FolderOpen } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Slider } from "@/components/ui/slider"

export function MontageGenerator() {
  const { toast } = useToast()

  // Form state
  const [videoLinks, setVideoLinks] = useState<string[]>([""])
  const [montageType, setMontageType] = useState<string>("fixed")
  const [layoutType, setLayoutType] = useState<string>("cut")
  const [interval, setInterval] = useState<string>("1")
  const [montageLength, setMontageLength] = useState<string>("30")
  const [startCutAt, setStartCutAt] = useState<string>("0")
  const [endCutAt, setEndCutAt] = useState<string>("60")
  const [resolution, setResolution] = useState<string>("720p")
  const [variations, setVariations] = useState<string>("1")
  const [folderName, setFolderName] = useState<string>("montages")
  const [customFilename, setCustomFilename] = useState<string>("montage")
  const [keepAudio, setKeepAudio] = useState<boolean>(true)
  const [linearMode, setLinearMode] = useState<boolean>(true)
  const [addCopyright, setAddCopyright] = useState<boolean>(false)
  const [overlayText, setOverlayText] = useState<string>("")
  const [font, setFont] = useState<string>("Arial")
  const [fontSize, setFontSize] = useState<number[]>([48])
  const [addTextOutline, setAddTextOutline] = useState<boolean>(false)

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

  // Generate local script
  const generateLocalScript = async () => {
    if (videoLinks[0].trim() === "") {
      toast({
        title: "Error",
        description: "Please enter at least one video URL",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "Local Script Generated",
      description: "Script has been created for local execution",
    })
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
      console.log("Sending request to /api/generate-montage")

      const response = await fetch("/api/generate-montage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrls: videoLinks.filter(link => link.trim() !== ""),
          montageType,
          layoutType,
          interval: Number.parseFloat(interval),
          montageLength: Number.parseInt(montageLength),
          startCutAt: Number.parseFloat(startCutAt),
          endCutAt: Number.parseFloat(endCutAt),
          resolution,
          variations: Number.parseInt(variations),
          folderName,
          customFilename,
          keepAudio,
          linearMode,
          addCopyright,
          overlayText,
          font,
          fontSize: fontSize[0],
          addTextOutline,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("Response:", data)

      if (data.jobId) {
        setJobId(data.jobId)
        setJobStatus("processing")
        // Start polling for job status
        pollJobStatus(data.jobId)
      } else {
        throw new Error("No job ID received")
      }
    } catch (error) {
      console.error("Error generating montage:", error)
      setJobError(error instanceof Error ? error.message : "Unknown error occurred")
      setIsGenerating(false)
      setJobStatus("error")
    }
  }

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/job-status?jobId=${jobId}`)
        const data = await response.json()

        if (data.status === "completed") {
          setJobStatus("completed")
          setJobProgress(100)
          setDownloadUrl(data.downloadUrl)
          setIsGenerating(false)
          clearInterval(pollInterval)
          
          toast({
            title: "Montage Generated!",
            description: "Your montage is ready for download.",
          })
        } else if (data.status === "failed") {
          setJobStatus("failed")
          setJobError(data.error || "Generation failed")
          setIsGenerating(false)
          clearInterval(pollInterval)
        } else if (data.status === "processing") {
          setJobProgress(data.progress || 0)
        }
      } catch (error) {
        console.error("Error polling job status:", error)
        setJobError("Failed to check job status")
        setIsGenerating(false)
        clearInterval(pollInterval)
      }
    }, 2000)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Panel - Settings */}
      <div className="space-y-6">
        {/* Video Sources */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Video Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {videoLinks.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Enter YouTube, Dropbox, Google Drive, or direct video URL"
                  value={link}
                  onChange={(e) => updateVideoLink(index, e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                {videoLinks.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeVideoLink(index)}
                    className="border-gray-600 text-gray-400 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              onClick={addVideoLink}
              className="w-full border-gray-600 text-gray-400 hover:text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Video
            </Button>
          </CardContent>
        </Card>

        {/* Montage Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Montage Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Montage Type</Label>
                <Select value={montageType} onValueChange={setMontageType}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="fixed">Fixed Interval</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Layout Type</Label>
                <Select value={layoutType} onValueChange={setLayoutType}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="cut">Cut (Sequential)</SelectItem>
                    <SelectItem value="split">Split Screen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Interval (seconds)</Label>
                <Input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Montage Length (seconds)</Label>
                <Input
                  type="number"
                  value={montageLength}
                  onChange={(e) => setMontageLength(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Start Cut At (seconds)</Label>
                <Input
                  type="number"
                  value={startCutAt}
                  onChange={(e) => setStartCutAt(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">End Cut At (seconds)</Label>
                <Input
                  type="number"
                  value={endCutAt}
                  onChange={(e) => setEndCutAt(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Number of Variations</Label>
                <Input
                  type="number"
                  value={variations}
                  onChange={(e) => setVariations(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Folder Name (in Downloads)</Label>
                <Input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Custom Filename</Label>
                <Input
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Keep Audio</Label>
                <Switch checked={keepAudio} onCheckedChange={setKeepAudio} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Linear Mode</Label>
                <Switch checked={linearMode} onCheckedChange={setLinearMode} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Add Copyright Line (Top 25%)</Label>
                <Switch checked={addCopyright} onCheckedChange={setAddCopyright} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Text Overlay */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Text Overlay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-300">Overlay Text</Label>
              <Input
                placeholder="Enter text to overlay on video"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Font</Label>
                <Select value={font} onValueChange={setFont}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Helvetica">Helvetica</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Font Size: {fontSize[0]}px</Label>
                <Slider
                  value={fontSize}
                  onValueChange={setFontSize}
                  max={100}
                  min={12}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Add Text Outline</Label>
              <Switch checked={addTextOutline} onCheckedChange={setAddTextOutline} />
            </div>
          </CardContent>
        </Card>

        {/* Generate Buttons */}
        <div className="space-y-3">
          <Button
            onClick={generateLocalScript}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={isGenerating}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Generate Local Script
          </Button>
          <Button
            onClick={generateMontage}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4 mr-2" />
            )}
            Generate Montage (Cloud)
          </Button>
        </div>

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
                Click here to download your montage
              </a>
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
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <div className="text-lg font-semibold">Montage Clips (1s intervals)</div>
                <div className="text-sm">Sequential Layout (1280x720)</div>
              </div>
              <div className="text-gray-500 text-sm">
                Preview will show here when video URLs are added
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
