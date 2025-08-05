"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MontageGenerator } from "@/components/montage-generator"
import { ReactionSplitGenerator } from "@/components/reaction-split-generator"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      {/* Header */}
      <header className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">🎬 Montage Maker</h1>
            <p className="text-gray-400 text-sm">Create amazing video montages and reaction videos with ease.</p>
          </div>
          <div className="flex space-x-4 text-sm">
            <a href="#" className="text-gray-300 hover:text-white">Generator</a>
            <a href="#" className="text-gray-300 hover:text-white">Install Guide</a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="montage" className="w-full">
          <TabsList className="grid grid-cols-2 mb-8 bg-gray-800 border border-gray-700">
            <TabsTrigger value="montage" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Generate Montage</TabsTrigger>
            <TabsTrigger value="reaction" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Reaction Video</TabsTrigger>
          </TabsList>

          <TabsContent value="montage" className="mt-0">
            <MontageGenerator />
          </TabsContent>

          <TabsContent value="reaction" className="mt-0">
            <ReactionSplitGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
