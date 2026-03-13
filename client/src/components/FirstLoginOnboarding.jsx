import React, { useState } from 'react';
import { apiRequest } from '../utils/api';

const avatars = ['🌳', '🌞', '💧', '🍃', '🐦', '🌍'];

const FirstLoginOnboarding = ({ user, onCompleted }) => {
  const [step, setStep] = useState(1);
  const [avatar, setAvatar] = useState('🍃');
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      await apiRequest('patch', '/v1/student/onboarding', { avatar });
      onCompleted?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-8">
        {step === 1 && (
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold text-[#0a1e0a]">Welcome to EcoKids, {user?.name}! 🌱</h2>
            <p className="text-gray-600">Let us set up your eco journey.</p>
            <div className="text-6xl animate-pulse">🌳🌱🌳</div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold text-[#0a1e0a]">Choose your eco avatar</h2>
            <div className="grid grid-cols-6 gap-3">
              {avatars.map((item) => (
                <button
                  key={item}
                  onClick={() => setAvatar(item)}
                  className={`text-3xl py-3 rounded-xl border ${avatar === item ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold text-[#0a1e0a]">Confirm details</h2>
            <p>Your school: <span className="font-semibold">{user?.profile?.school || '-'}</span></p>
            <p>Grade: <span className="font-semibold">{user?.profile?.grade || user?.grade || '-'}</span></p>
          </div>
        )}

        {step === 4 && (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-[#0a1e0a]">You earned your first badge! 🏅 EcoStarter</h2>
            <div className="text-5xl">🎉 {avatar} 🎉</div>
            <p className="text-gray-600">Great start. Keep learning and earning EcoCoins.</p>
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3">
          {step < 4 ? (
            <button onClick={() => setStep(step + 1)} className="px-5 py-2.5 bg-green-600 text-white rounded-lg">Next</button>
          ) : (
            <button onClick={finish} disabled={saving} className="px-5 py-2.5 bg-green-600 text-white rounded-lg disabled:opacity-60">
              {saving ? 'Saving...' : 'Start Learning'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FirstLoginOnboarding;
