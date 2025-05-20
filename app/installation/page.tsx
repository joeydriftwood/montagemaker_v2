"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Laptop, Monitor } from "lucide-react"

export default function InstallationPage() {
  const [selectedDevice, setSelectedDevice] = useState<"mac" | "pc" | null>(null)

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-normal mb-4">Installation Guide</h1>
          <p className="text-sm text-gray-600 mb-8">
            Select your device to see the appropriate installation instructions.
          </p>

          <div className="flex justify-center gap-4 mb-8">
            <Button
              variant={selectedDevice === "mac" ? "default" : "outline"}
              className={`px-8 py-6 ${selectedDevice === "mac" ? "bg-blue-600" : "border-gray-300"}`}
              onClick={() => setSelectedDevice("mac")}
            >
              <Laptop className="mr-2 h-5 w-5" />
              Mac
            </Button>
            <Button
              variant={selectedDevice === "pc" ? "default" : "outline"}
              className={`px-8 py-6 ${selectedDevice === "pc" ? "bg-blue-600" : "border-gray-300"}`}
              onClick={() => setSelectedDevice("pc")}
            >
              <Monitor className="mr-2 h-5 w-5" />
              PC / Windows
            </Button>
          </div>
        </div>

        {selectedDevice && (
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4 text-center">🎛 Install FFmpeg</h2>
            <div className="flex justify-center gap-4 mb-6">
              <Button
                variant={selectedDevice === "mac" ? "default" : "outline"}
                className={`px-8 py-3 ${selectedDevice === "mac" ? "bg-blue-600" : "border-gray-300"}`}
                onClick={() => setSelectedDevice("mac")}
              >
                I'm on macOS
              </Button>
              <Button
                variant={selectedDevice === "pc" ? "default" : "outline"}
                className={`px-8 py-3 ${selectedDevice === "pc" ? "bg-blue-600" : "border-gray-300"}`}
                onClick={() => setSelectedDevice("pc")}
              >
                I'm on Windows
              </Button>
            </div>
          </div>
        )}

        {selectedDevice && (
          <div className="space-y-8">
            {selectedDevice === "mac" ? (
              <>
                <Card className="border border-gray-300">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4 flex items-center">
                      <span className="mr-2">🛠️</span> Step 1: Install Homebrew
                    </h2>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">
                        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                      </pre>
                    </div>
                    <p className="text-sm mb-2">You can test if it's already installed by running:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">brew -v</pre>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-300">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4 flex items-center">
                      <span className="mr-2">🎥</span> Step 2: Install FFmpeg
                    </h2>
                    <p className="text-sm mb-4">Install FFmpeg using Homebrew:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">
                        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
                        brew install ffmpeg ffmpeg -version # test it
                      </pre>
                    </div>
                    <p className="text-sm mb-2">You can test if it's already installed by running:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">ffmpeg -version</pre>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-300">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4 flex items-center">
                      <span className="mr-2">💻</span> Step 3: Run Shell Scripts
                    </h2>
                    <p className="text-sm mb-4">
                      Each montage script we generate is a .sh file. After downloading one:
                    </p>
                    <p className="text-sm font-medium mb-2">
                      Navigate to your Downloads folder first (or wherever your script is saved):
                    </p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">cd ~/Downloads</pre>
                    </div>
                    <p className="text-sm font-medium mb-2">Make it executable:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">
                        chmod +x your_script_name.sh
                      </pre>
                    </div>
                    <p className="text-sm font-medium mb-2">Run it:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">./your_script_name.sh</pre>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-300">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4 flex items-center">
                      <span className="mr-2">⚡</span> Quick Commands (Mac)
                    </h2>
                    <p className="text-sm mb-4">
                      Copy and paste these commands to quickly set up and run your montage:
                    </p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">
                        # Install everything (one-time setup) /bin/bash -c "$(curl -fsSL
                        https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && brew install ffmpeg
                      </pre>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">
                        # Run a montage script cd ~/Downloads && chmod +x your_script_name.sh && ./your_script_name.sh
                      </pre>
                    </div>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          "cd ~/Downloads && chmod +x your_script_name.sh && ./your_script_name.sh",
                        )
                        alert("Mac command copied to clipboard!")
                      }}
                      className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Copy Mac Code
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="border border-gray-300">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4 flex items-center">
                      <span className="mr-2">🛠️</span> Step 1: Install Git Bash
                    </h2>
                    <p className="text-sm mb-4">Git Bash provides a Linux-like terminal environment for Windows:</p>
                    <ol className="list-decimal list-inside text-sm space-y-2 mb-4">
                      <li>
                        Download Git for Windows from{" "}
                        <a
                          href="https://git-scm.com/download/win"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          git-scm.com
                        </a>
                      </li>
                      <li>Run the installer and follow the prompts</li>
                      <li>Make sure to select "Git Bash Here" during installation</li>
                      <li>After installation, you can right-click in any folder and select "Git Bash Here"</li>
                    </ol>
                    <p className="text-sm mb-2">Test if Git Bash is installed by opening it and typing:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">git --version</pre>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-300">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4 flex items-center">
                      <span className="mr-2">🎥</span> Step 2: Install FFmpeg
                    </h2>
                    <p className="text-sm mb-4">Follow these steps to install FFmpeg on Windows:</p>
                    <ol className="list-decimal list-inside text-sm space-y-4 mb-4">
                      <li>
                        <strong>Download the official Windows build</strong>
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>
                            Go to{" "}
                            <a
                              href="https://www.gyan.dev/ffmpeg/builds/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              https://www.gyan.dev/ffmpeg/builds/
                            </a>
                          </li>
                          <li>
                            Get <code className="bg-gray-100 px-1 py-0.5 rounded">ffmpeg-release-full.zip</code> from
                            the "Release builds" section
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>Extract the folder</strong>
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>Extract the .zip and move the folder to:</li>
                        </ul>
                        <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto my-2">
                          <pre className="text-xs font-mono whitespace-pre-wrap text-black">C:\ffmpeg</pre>
                        </div>
                      </li>
                      <li>
                        <strong>Add to your System PATH</strong>
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>Open Start → search for Environment Variables</li>
                          <li>Open Environment Variables → under System variables, find Path → click Edit</li>
                          <li>Click New, and paste:</li>
                        </ul>
                        <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto my-2">
                          <pre className="text-xs font-mono whitespace-pre-wrap text-black">C:\ffmpeg\bin</pre>
                        </div>
                        <ul className="list-disc list-inside ml-6 mt-1">
                          <li>Hit OK to save</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Restart your terminal (Git Bash or CMD), then run:</strong>
                        <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto my-2">
                          <pre className="text-xs font-mono whitespace-pre-wrap text-black">ffmpeg -version</pre>
                        </div>
                        <p className="text-sm mt-1">You should see FFmpeg version info appear.</p>
                      </li>
                    </ol>
                  </CardContent>
                </Card>

                <Card className="border border-gray-300">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4 flex items-center">
                      <span className="mr-2">💻</span> Step 3: Run Shell Scripts
                    </h2>
                    <p className="text-sm mb-4">
                      Each montage script we generate is a .sh file. After downloading one:
                    </p>
                    <p className="text-sm font-medium mb-2">
                      Open Git Bash in your Downloads folder (right-click in the folder and select "Git Bash Here") or
                      navigate to it:
                    </p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">cd ~/Downloads</pre>
                    </div>
                    <p className="text-sm font-medium mb-2">Make it executable:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">
                        chmod +x your_script_name.sh
                      </pre>
                    </div>
                    <p className="text-sm font-medium mb-2">Run it:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">./your_script_name.sh</pre>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-gray-300">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-medium mb-4 flex items-center">
                      <span className="mr-2">⚡</span> Quick Commands (Windows)
                    </h2>
                    <p className="text-sm mb-4">Copy and paste these commands in Git Bash to run your montage:</p>
                    <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto mb-4">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-black">
                        # Run a montage script cd ~/Downloads && bash your_script_name.sh
                      </pre>
                    </div>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText("cd ~/Downloads && bash your_script_name.sh")
                        alert("PC command copied to clipboard!")
                      }}
                      className="w-full bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Copy PC Code
                    </Button>
                    <p className="text-sm mt-4 text-gray-600">
                      Note: For Windows, you need to install Git Bash and FFmpeg manually as described in steps 1 and 2.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            <Card className="border border-gray-300">
              <CardContent className="p-6">
                <h2 className="text-lg font-medium mb-4 flex items-center">
                  <span className="mr-2">📁</span> Notes:
                </h2>
                <ul className="text-sm space-y-2 list-disc pl-5">
                  <li>
                    The final montage file will appear in your Downloads folder unless otherwise stated in the script.
                  </li>
                  <li>
                    You don't need to install any video editors or additional tools — all clips are generated using
                    ffmpeg.
                  </li>
                  <li>
                    If you encounter any issues, check that FFmpeg is properly installed and accessible from your
                    terminal.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
