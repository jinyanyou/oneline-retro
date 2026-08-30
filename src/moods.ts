export type Mood = 'good' | 'soso' | 'bad';

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 'good', emoji: '😊', label: '좋았다' },
  { value: 'soso', emoji: '😐', label: '그럭저럭' },
  { value: 'bad', emoji: '😞', label: '아쉬웠다' },
];

export function moodOf(mood: Mood | null | undefined) {
  return MOODS.find((m) => m.value === mood);
}
