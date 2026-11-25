import React, { useEffect, useState } from 'react';
import { Check, Shield, User, X } from 'lucide-react';
import { useVeyra } from '../context/VeyraContext';
import { apiRequest } from '../lib/api';

const PRESET_AVATARS = [
  { id: 'bull', name: 'Market Bull', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80' },
  { id: 'globe', name: 'Global FX', url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=150&auto=format&fit=crop&q=80' },
  { id: 'analyst', name: 'Quant Analyst', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' },
  { id: 'macro', name: 'Macro Trader', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80' },
  { id: 'sovereign', name: 'Sovereign', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
  { id: 'crypto', name: 'Digital Native', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80' },
];

const STARTER_ASSETS: Array<{ symbol: string; name: string; type: 'fiat' | 'crypto' }> = [
  { symbol: 'INR', name: 'Indian Rupee', type: 'fiat' },
  { symbol: 'USD', name: 'US Dollar', type: 'fiat' },
  { symbol: 'EUR', name: 'Euro', type: 'fiat' },
  { symbol: 'GBP', name: 'British Pound', type: 'fiat' },
  { symbol: 'JPY', name: 'Japanese Yen', type: 'fiat' },
  { symbol: 'AED', name: 'UAE Dirham', type: 'fiat' },
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto' },
];

function isAlreadyOnboarded(
  user: { id: string; avatar_url: string | null; created_at: string } | null,
  watchlistCount: number
): boolean {
  if (!user) return true;
  if (watchlistCount > 0 || Boolean(user.avatar_url)) return true;
  const createdMs = Date.parse(user.created_at);
  if (Number.isFinite(createdMs) && Date.now() - createdMs > 5 * 60 * 1000) {
    return true;
  }
  try {
    return localStorage.getItem(`veyra_onboarded_${user.id}`) === 'true';
  } catch {
    return false;
  }
}

export function OnboardingModal() {
  const { user, watchlist, refreshAuth, refreshUserData, notify } = useVeyra();

  const [isOpen, setIsOpen] = useState(() => !isAlreadyOnboarded(user, watchlist.length));

  useEffect(() => {
    if (!user) {
      setIsOpen(false);
      return;
    }
    if (isAlreadyOnboarded(user, watchlist.length)) {
      try {
        localStorage.setItem(`veyra_onboarded_${user.id}`, 'true');
      } catch {}
      setIsOpen(false);
    }
  }, [user, watchlist.length]);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(user?.avatar_url || PRESET_AVATARS[0].url);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['INR', 'USD', 'BTC', 'ETH']);
  const [saving, setSaving] = useState(false);

  if (!isOpen || !user) return null;

  const handleSkip = () => {
    try {
      localStorage.setItem(`veyra_onboarded_${user.id}`, 'true');
    } catch {}
    setIsOpen(false);
  };

  const toggleSymbol = (sym: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const avatarUrl = customAvatarUrl.trim() || selectedAvatar;

      // 1. Update display name & avatar
      if (fullName.trim() !== user.full_name || avatarUrl !== user.avatar_url) {
        await apiRequest('/api/auth/profile', {
          method: 'PATCH',
          body: {
            full_name: fullName.trim() || user.full_name || 'Veyra Analyst',
            avatar_url: avatarUrl || null,
          },
        });
      }

      // 2. Add initial watchlist assets
      for (const sym of selectedSymbols) {
        const item = STARTER_ASSETS.find((a) => a.symbol === sym);
        if (item) {
          try {
            await apiRequest('/api/user/watchlist', {
              method: 'POST',
              body: {
                symbol: item.symbol,
                asset_type: item.type,
              },
            });
          } catch {
            // Asset might already be in watchlist
          }
        }
      }

      try {
        localStorage.setItem(`veyra_onboarded_${user.id}`, 'true');
      } catch {}

      await refreshAuth();
      await refreshUserData();
      notify('Your Veyra profile and initial watchlist have been saved.', 'success');
      setIsOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save profile setup.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65">
      <div className="relative w-full max-w-lg rounded-2xl border border-[#e4e4e7] dark:border-white/10 bg-white dark:bg-[#11141c] p-6 sm:p-8 shadow-xl text-[#09090b] dark:text-[#fafafa] space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] text-[11px] font-semibold">
              <span>First-Time Setup</span>
            </div>
            <h2 className="font-display text-xl font-semibold tracking-tight">Set Up Your Analyst Profile</h2>
            <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
              Customize your profile name, profile picture, and initial market watchlist.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="text-[#71717a] hover:text-[#09090b] dark:hover:text-white p-1 rounded-lg hover:bg-[#f4f4f5] dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Skip setup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleComplete} className="space-y-5">
          {/* 1. Profile Picture / Avatar Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#52525b] dark:text-[#a1a1aa]">
              Choose Your Profile Picture
            </label>
            <div className="grid grid-cols-6 gap-2 pt-1">
              {PRESET_AVATARS.map((av) => {
                const isSelected = selectedAvatar === av.url && !customAvatarUrl;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(av.url);
                      setCustomAvatarUrl('');
                    }}
                    className={`relative rounded-full aspect-square overflow-hidden border-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#3b82f6] ring-2 ring-[#3b82f6]/40'
                        : 'border-transparent hover:border-[#3b82f6]/50 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={av.url} alt={av.name} className="h-full w-full object-cover" />
                    {isSelected && (
                      <span className="absolute inset-0 bg-[#3b82f6]/25 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="pt-1.5">
              <input
                type="url"
                value={customAvatarUrl}
                onChange={(e) => setCustomAvatarUrl(e.target.value)}
                placeholder="Or paste custom image URL (optional)..."
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-[#f4f4f5]/60 dark:bg-white/[0.04] px-3 py-1.5 text-xs focus:outline-none focus:border-[#3b82f6]"
              />
            </div>
          </div>

          {/* 2. Display Name */}
          <div className="space-y-1.5">
            <label htmlFor="onboarding-name" className="block text-xs font-semibold text-[#52525b] dark:text-[#a1a1aa]">
              Your Display Name
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="onboarding-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Akshat Sharma"
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-[#f4f4f5]/60 dark:bg-white/[0.04] pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#3b82f6]"
              />
            </div>
          </div>

          {/* 3. Starter Watchlist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-[#52525b] dark:text-[#a1a1aa]">
                Select Assets for Your Watchlist
              </label>
              <span className="text-[11px] text-[#71717a]">
                {selectedSymbols.length} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_ASSETS.map((asset) => {
                const isChecked = selectedSymbols.includes(asset.symbol);
                return (
                  <button
                    key={asset.symbol}
                    type="button"
                    onClick={() => toggleSymbol(asset.symbol)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-[#3b82f6] text-white shadow-xs'
                        : 'border border-[#e4e4e7] dark:border-white/10 bg-[#f4f4f5]/60 dark:bg-white/[0.03] text-[#52525b] dark:text-[#a1a1aa] hover:border-[#3b82f6]/40'
                    }`}
                  >
                    <span>{asset.symbol}</span>
                    <span className="text-[10px] opacity-75">· {asset.name}</span>
                    {isChecked && <Check className="h-3 w-3 stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-[#e4e4e7] dark:border-white/10">
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-[#71717a] hover:text-[#09090b] dark:hover:text-white transition-colors cursor-pointer"
            >
              Skip for Now
            </button>

            <button
              type="submit"
              disabled={saving || !fullName.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white px-5 py-2.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              <span>{saving ? 'Saving Profile...' : 'Save & Enter Dashboard'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
