"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MontageGenerator } from "@/components/montage-generator"
import { ReactionSplitGenerator } from "@/components/reaction-split-generator"
import VideoForm from "@/components/VideoForm";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-black font-sans">
      {/* Header */}
      <header className="p-4 border-b border-gray-200 bg-white">
        <div className="text-xl font-normal text-center">🎬 Montage Maker</div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <Tabs defaultValue="montage" className="w-full">
          <TabsList className="grid grid-cols-2 mb-8">
            <TabsTrigger value="montage">Montage Generator</TabsTrigger>
            <TabsTrigger value="reaction">Reaction Video</TabsTrigger>
          </TabsList>

          <TabsContent value="montage">
            <VideoForm />
            <MontageGenerator />
          </TabsContent>

          <TabsContent value="reaction">
            <ReactionSplitGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
