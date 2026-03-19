import type { LucideIcon } from 'lucide-react';
import {
  // Collection staples
  BookOpen, Stamp, Coins, Ship, Mail, Frame, Puzzle, Car, Gift, Watch,
  // Art & creative
  Palette, Paintbrush, Pen, Pencil, Brush, Aperture, Camera, Film, Clapperboard, Music, Headphones,
  // Tech & gadgets
  Smartphone, Laptop, Monitor, Cpu, Gamepad2, Joystick,
  // Nature & science
  Globe, Leaf, TreePine, Flower2, Bug, FlaskConical, Telescope, Microscope,
  // Fashion & lifestyle
  Diamond, Crown, Gem, Glasses, Shirt, Footprints,
  // Home & objects
  Lamp, Armchair, Key, Wrench, Hammer, Scissors, Utensils,
  // Sports & hobbies
  Bike, Dumbbell, Trophy, Target, Swords, Dice5, Tent,
  // Symbols & misc
  Heart, Star, Sparkles, Flame, Zap, Shield, Flag, Rocket, Plane, MapPin,
  Anchor, Compass, Wine, Coffee, IceCream2, Candy,
  // Generic fallback
  Package, MoreHorizontal,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  BookOpen, Stamp, Coins, Ship, Mail, Frame, Puzzle, Car, Gift, Watch,
  Palette, Paintbrush, Pen, Pencil, Brush, Aperture, Camera, Film, Clapperboard, Music, Headphones,
  Smartphone, Laptop, Monitor, Cpu, Gamepad2, Joystick,
  Globe, Leaf, TreePine, Flower2, Bug, FlaskConical, Telescope, Microscope,
  Diamond, Crown, Gem, Glasses, Shirt, Footprints,
  Lamp, Armchair, Key, Wrench, Hammer, Scissors, Utensils,
  Bike, Dumbbell, Trophy, Target, Swords, Dice5, Tent,
  Heart, Star, Sparkles, Flame, Zap, Shield, Flag, Rocket, Plane, MapPin,
  Anchor, Compass, Wine, Coffee, IceCream2, Candy,
  Package, MoreHorizontal,
};

export const ICON_NAMES = Object.keys(CATEGORY_ICONS);

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] ?? Package;
}
