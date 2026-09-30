import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function ProfileView() {
  const { user, updateUserProfile } = useApp();
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'success'
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    school: '',
    subjects: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        school: user.school || '',
        subjects: user.subjects || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    const result = await updateUserProfile(formData);
    
    if (result.success) {
      setSaveStatus('success');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } else {
      setSaveStatus('idle');
    }
  };

  return (
    <div className="flex-1 flex justify-center items-start animate-fadeIn">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-headline-lg font-bold text-on-surface mb-2">Profile Settings</h2>
          <p className="text-body-md text-on-surface-variant">Manage your account details and security preferences.</p>
        </div>

        {/* Main Card */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.05)] p-6 md:p-8">
          
          {/* Top Section: Avatar */}
          <div className="flex flex-col items-center mb-8 animate-fadeIn">
            <div className="relative mb-4 group cursor-pointer">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container-lowest shadow-[0px_8px_30px_rgba(0,0,0,0.08)] bg-primary flex items-center justify-center">
                <span className="text-on-primary text-4xl font-bold">
                  {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div className="absolute bottom-1 right-1 w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg border-2 border-surface-container-lowest transform transition-transform duration-300 group-hover:scale-110">
                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              </div>
            </div>
            <h3 className="text-headline-md font-bold text-on-surface">{user?.name}</h3>
            <p className="text-body-md text-on-surface-variant">{user?.email}</p>
          </div>

          {/* Profile Details Section */}
          <section className="mb-8 animate-fadeIn [animation-delay:100ms]">
            <h4 className="text-body-lg font-semibold text-on-surface mb-6 border-b border-outline-variant pb-2">Profile Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl border-[1.5px] border-[#E4E7EC] bg-surface-container-lowest transition-all">
                <label className="block px-4 pt-2 text-label-sm text-on-surface-variant font-semibold">Full Name</label>
                <input name="name" value={formData.name} onChange={handleChange} className="w-full px-4 pb-2 pt-1 bg-transparent border-none text-body-md text-on-surface focus:ring-0 outline-none" type="text" placeholder="Full Name" />
              </div>
              <div className="focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl border-[1.5px] border-[#E4E7EC] bg-surface-container-lowest transition-all">
                <label className="block px-4 pt-2 text-label-sm text-on-surface-variant font-semibold">Email</label>
                <input name="email" value={formData.email} onChange={handleChange} className="w-full px-4 pb-2 pt-1 bg-transparent border-none text-body-md text-on-surface focus:ring-0 outline-none" type="email" placeholder="Email" />
              </div>
              <div className="focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl border-[1.5px] border-[#E4E7EC] bg-surface-container-lowest transition-all">
                <label className="block px-4 pt-2 text-label-sm text-on-surface-variant font-semibold">Phone (Optional)</label>
                <input name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 pb-2 pt-1 bg-transparent border-none text-body-md text-on-surface focus:ring-0 outline-none" placeholder="+1 (555) 000-0000" type="tel"/>
              </div>
              <div className="focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl border-[1.5px] border-[#E4E7EC] bg-surface-container-lowest transition-all">
                <label className="block px-4 pt-2 text-label-sm text-on-surface-variant font-semibold">Institution Name</label>
                <input name="school" value={formData.school} onChange={handleChange} className="w-full px-4 pb-2 pt-1 bg-transparent border-none text-body-md text-on-surface focus:ring-0 outline-none" type="text" placeholder="Institution Name" />
              </div>
              <div className="focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl border-[1.5px] border-[#E4E7EC] bg-surface-container-lowest transition-all md:col-span-2">
                <label className="block px-4 pt-2 text-label-sm text-on-surface-variant font-semibold">Subject(s) Taught</label>
                <input name="subjects" value={formData.subjects} onChange={handleChange} className="w-full px-4 pb-2 pt-1 bg-transparent border-none text-body-md text-on-surface focus:ring-0 outline-none" type="text" placeholder="Physics, Mathematics" />
              </div>
            </div>
          </section>

          {/* Change Password Section */}
          <section className="mb-8 animate-fadeIn [animation-delay:200ms]">
            <h4 className="text-body-lg font-semibold text-on-surface mb-6 border-b border-outline-variant pb-2">Change Password</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl border-[1.5px] border-[#E4E7EC] bg-surface-container-lowest transition-all md:col-span-2">
                <label className="block px-4 pt-2 text-label-sm text-on-surface-variant font-semibold">Current Password</label>
                <input className="w-full px-4 pb-2 pt-1 bg-transparent border-none text-body-md text-on-surface focus:ring-0 outline-none" placeholder="••••••••" type="password"/>
              </div>
              <div className="focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl border-[1.5px] border-[#E4E7EC] bg-surface-container-lowest transition-all">
                <label className="block px-4 pt-2 text-label-sm text-on-surface-variant font-semibold">New Password</label>
                <input className="w-full px-4 pb-2 pt-1 bg-transparent border-none text-body-md text-on-surface focus:ring-0 outline-none" placeholder="••••••••" type="password"/>
              </div>
              <div className="focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 rounded-xl border-[1.5px] border-[#E4E7EC] bg-surface-container-lowest transition-all">
                <label className="block px-4 pt-2 text-label-sm text-on-surface-variant font-semibold">Confirm Password</label>
                <input className="w-full px-4 pb-2 pt-1 bg-transparent border-none text-body-md text-on-surface focus:ring-0 outline-none" placeholder="••••••••" type="password"/>
              </div>
            </div>
          </section>

          {/* Footer Actions */}
          <div className="pt-6 border-t border-outline-variant flex justify-end gap-4 animate-fadeIn [animation-delay:300ms]">
            <button className="h-12 px-6 rounded-xl border-[1.5px] border-primary text-primary font-semibold hover:bg-surface-container-low transition-colors min-w-[120px]">
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className={`h-12 px-8 rounded-xl font-semibold shadow-[0px_4px_20px_rgba(0,0,0,0.05)] transition-all min-w-[160px] flex items-center justify-center gap-2 overflow-hidden relative ${
                saveStatus === 'success' 
                  ? 'bg-secondary-container text-on-secondary-container' 
                  : 'bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container'
              }`}
            >
              <span 
                className="transition-all duration-300"
                style={{ 
                  opacity: saveStatus === 'success' ? 0 : 1, 
                  transform: saveStatus === 'success' ? 'translateY(-20px)' : 'translateY(0)' 
                }}
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
              </span>
              <span 
                className={`material-symbols-outlined absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
                  saveStatus === 'success' ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
                }`}
              >
                check_circle
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
