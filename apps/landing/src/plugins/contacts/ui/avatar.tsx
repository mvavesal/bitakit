'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('');

/** A contact's photo, with initials while it loads or if it fails. */
export function PersonAvatar({
  name,
  photo,
  className,
}: {
  name: string;
  photo?: string;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {photo && <AvatarImage src={photo} alt="" className="object-cover" />}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
