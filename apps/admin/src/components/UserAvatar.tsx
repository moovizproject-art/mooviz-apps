import type { UserRole } from '../services/users';

interface UserAvatarProps {
  name: string;
  photoURL?: string | null;
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
}

const roleColors: Record<UserRole, string> = {
  sender: 'ring-blue-400',
  driver: 'ring-green-400',
  both: 'ring-purple-400',
  admin: 'ring-red-400',
  moderator: 'ring-yellow-400',
};

const roleBadgeColors: Record<UserRole, string> = {
  sender: 'bg-blue-100 text-blue-700',
  driver: 'bg-green-100 text-green-700',
  both: 'bg-purple-100 text-purple-700',
  admin: 'bg-red-100 text-red-700',
  moderator: 'bg-yellow-100 text-yellow-700',
};

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export default function UserAvatar({ name, photoURL, role, size = 'md' }: UserAvatarProps) {
  const initials = name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className={`relative ${sizeClasses[size]} flex-shrink-0`}>
        {photoURL ? (
          <img
            src={photoURL}
            alt={name}
            className={`${sizeClasses[size]} rounded-full object-cover ring-2 ${roleColors[role]}`}
          />
        ) : (
          <div
            className={`${sizeClasses[size]} flex items-center justify-center rounded-full bg-gray-200 font-medium text-gray-600 ring-2 ${roleColors[role]}`}
          >
            {initials}
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeColors[role]}`}>
          {role}
        </span>
      </div>
    </div>
  );
}
