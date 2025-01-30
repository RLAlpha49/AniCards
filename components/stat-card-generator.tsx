"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAniListData } from "@/lib/anilist/client";
import { USER_ID_QUERY, USER_STATS_QUERY } from "@/lib/anilist/queries";

interface StatCardGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
}

const statCardTypes = [
  {
    id: "animeStats",
    label:
      "Anime Stats (Count, Episodes Watched, Minutes Watched, Mean Score, Standard Deviation)",
  },
  {
    id: "socialStats",
    label:
      "Social Stats (Total Activities (30 Days), Followers, Following, Thread Posts/Comments, Reviews)",
  },
  {
    id: "mangaStats",
    label:
      "Manga Stats (Count, Chapters Read, Volumes Read, Mean Score, Standard Deviation)",
  },
  { id: "animeGenres", label: "Anime Genres (Top 5 Count)" },
  { id: "animeTags", label: "Anime Tags (Top 5 Count)" },
  { id: "animeVoiceActors", label: "Anime Voice Actors (Top 5 Count)" },
  { id: "animeStudios", label: "Anime Studios (Top 5 Count)" },
  { id: "animeStaff", label: "Anime Staff (Top 5 Count)" },
  { id: "mangaGenres", label: "Manga Genres (Top 5 Count)" },
  { id: "mangaTags", label: "Manga Tags (Top 5 Count)" },
  { id: "mangaStaff", label: "Manga Staff (Top 5 Count)" },
];

const colorPresets = {
  default: ["#fe428e", "#141321", "#a9fef7", "#fe428e"],
  sunset: ["#ff7e5f", "#feb47b", "#ffffff", "#ff7e5f"],
  ocean: ["#00b4d8", "#03045e", "#caf0f8", "#00b4d8"],
  forest: ["#2d6a4f", "#081c15", "#d8f3dc", "#2d6a4f"],
  lavender: ["#7c3aed", "#ede9fe", "#1e1b4b", "#7c3aed"],
};

export function StatCardGenerator({ isOpen, onClose }: StatCardGeneratorProps) {
  const [username, setUsername] = useState("");
  const [titleColor, setTitleColor] = useState(colorPresets.default[0]);
  const [backgroundColor, setBackgroundColor] = useState(
    colorPresets.default[1]
  );
  const [textColor, setTextColor] = useState(colorPresets.default[2]);
  const [circleColor, setCircleColor] = useState(colorPresets.default[3]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("default");

  const handleCheckboxChange = (id: string) => {
    setSelectedCards((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    setTitleColor(colorPresets[preset as keyof typeof colorPresets][0]);
    setBackgroundColor(colorPresets[preset as keyof typeof colorPresets][1]);
    setTextColor(colorPresets[preset as keyof typeof colorPresets][2]);
    setCircleColor(colorPresets[preset as keyof typeof colorPresets][3]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Get user ID first
      const userIdData = await fetchAniListData<{
        User: { id: number } | null;
      }>(USER_ID_QUERY, {
        userName: username,
      });

      if (!userIdData?.User?.id) {
        alert("User not found");
        return;
      }

      // Get all stats
      const statsData = await fetchAniListData(USER_STATS_QUERY, {
        userName: username,
        userId: userIdData.User.id,
      });

      // Process the data and combine with form settings
      const payload = {
        username,
        titleColor,
        backgroundColor,
        textColor,
        circleColor,
        selectedCards,
        stats: statsData,
      };

      console.log("Generated Card Data:", payload);
      onClose();
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Failed to generate cards. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] overflow-y-auto max-h-[calc(100vh-2rem)]">
        <DialogHeader>
          <DialogTitle>Generate Your Stat Cards</DialogTitle>
          <DialogDescription>
            Enter your details and select the stat cards you want to generate.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your Anilist username"
            />
          </div>
          <div>
            <Label htmlFor="colorPreset">Color Preset</Label>
            <Select onValueChange={handlePresetChange} value={selectedPreset}>
              <SelectTrigger>
                <SelectValue placeholder="Select a color preset" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="sunset">Sunset</SelectItem>
                <SelectItem value="ocean">Ocean</SelectItem>
                <SelectItem value="forest">Forest</SelectItem>
                <SelectItem value="lavender">Lavender</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="titleColor">Title Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="titleColor"
                  type="color"
                  value={titleColor}
                  onChange={(e) => setTitleColor(e.target.value)}
                  className="w-12 h-12 p-1 rounded"
                />
                <Input
                  type="text"
                  value={titleColor}
                  onChange={(e) => setTitleColor(e.target.value)}
                  className="flex-grow"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="backgroundColor">Background Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="backgroundColor"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-12 h-12 p-1 rounded"
                />
                <Input
                  type="text"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="flex-grow"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="textColor">Text Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="textColor"
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-12 h-12 p-1 rounded"
                />
                <Input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="flex-grow"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="circleColor">Circle Color</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="circleColor"
                  type="color"
                  value={circleColor}
                  onChange={(e) => setCircleColor(e.target.value)}
                  className="w-12 h-12 p-1 rounded"
                />
                <Input
                  type="text"
                  value={circleColor}
                  onChange={(e) => setCircleColor(e.target.value)}
                  className="flex-grow"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Select Stat Cards to Generate</Label>
            {statCardTypes.map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <Checkbox
                  id={type.id}
                  checked={selectedCards.includes(type.id)}
                  onCheckedChange={() => handleCheckboxChange(type.id)}
                />
                <Label htmlFor={type.id}>{type.label}</Label>
              </div>
            ))}
          </div>
          <Button type="submit" className="w-full">
            Generate Stat Cards
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
