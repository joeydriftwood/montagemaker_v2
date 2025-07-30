import { MontageGenerator } from "@/components/montage-generator"
import { ReactionSplitGenerator } from "@/components/reaction-split-generator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Montage Maker</h1>
          <p className="text-lg text-gray-600">Create amazing video montages and reaction videos with ease</p>
        </div>

        <Tabs defaultValue="montage" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="montage">Generate Montage</TabsTrigger>
            <TabsTrigger value="reaction">Reaction Video</TabsTrigger>
          </TabsList>

          <TabsContent value="montage" className="mt-6">
            <MontageGenerator />
          </TabsContent>

          <TabsContent value="reaction" className="mt-6">
            <ReactionSplitGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
