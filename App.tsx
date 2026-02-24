
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MatrixRain from './components/MatrixRain';
import { DEFAULT_SHEET_ID, COLORS } from './constants';
import { fetchSheetData, createBooking, updateBookingStatus, updateTenantInSheet } from './services/sheetService';
import { suggestTaskDetails } from './services/geminiService';
import { Room, Invoice, Tenant, Booking, UserRole, TenantDocument, Task } from './types';

const App: React.FC = () => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [currentUserTenant, setCurrentUserTenant] = useState<Tenant | null>(null);
  const [showPublicBooking, setShowPublicBooking] = useState(false);

  // App State
  const [activePage, setActivePage] = useState('dashboard');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kernelStatus, setKernelStatus] = useState<'IDLE' | 'CONNECTING' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [kernelErrorMessage, setKernelErrorMessage] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('kernel_last_sync'));
  
  // Tenant Details & Edit State
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [editTenantForm, setEditTenantForm] = useState<Tenant | null>(null);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [isSyncingTenant, setIsSyncingTenant] = useState(false);

  const [tenantDocs, setTenantDocs] = useState<TenantDocument[]>([]);
  const [pendingUpload, setPendingUpload] = useState<{ name: string; mimeType: string; data: string } | null>(null);

  // Admin Setting State
  const [sheetId, setSheetId] = useState(localStorage.getItem('sheetId') || DEFAULT_SHEET_ID);
  const [scriptUrl, setScriptUrl] = useState(localStorage.getItem('scriptUrl') || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUpdatingBooking, setIsUpdatingBooking] = useState<string | null>(null);
  
  // Tasks Page Filter & AI
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('All');
  const [aiTaskInput, setAiTaskInput] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{ assignee: string, priority: string, reasoning: string } | null>(null);

  // Booking Form State
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [bookingForm, setBookingForm] = useState({ name: '', phone: '', moveInDate: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI State
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<{ type: string; data: any } | null>(null);

  const initKernel = useCallback(async () => {
    setKernelStatus('CONNECTING');
    setKernelErrorMessage(null);
    try {
      const data = await fetchSheetData();
      if (data) {
        setRooms(data.rooms || []);
        setTenants(data.tenants || []);
        setInvoices(data.invoices || []);
        setBookings(data.bookings || []);
        setTasks(data.tasks || []);
        setKernelStatus('CONNECTED');
        setLastSync(new Date().toISOString());
      }
    } catch (e: any) {
      console.error("Kernel initialization failed:", e);
      setKernelStatus('ERROR');
      setKernelErrorMessage(e.message || 'Unknown kernel failure');
      
      const cached = localStorage.getItem('kernel_cache');
      if (cached) {
        const data = JSON.parse(cached);
        setRooms(data.rooms || []);
        setTenants(data.tenants || []);
        setInvoices(data.invoices || []);
        setBookings(data.bookings || []);
        setTasks(data.tasks || []);
      }
    }
  }, []);

  useEffect(() => {
    initKernel();
    const savedRole = localStorage.getItem('userRole');
    if (savedRole) {
      setIsAuthenticated(true);
      setUserRole(savedRole as UserRole);
      
      if (savedRole === UserRole.STAF) {
        const savedUsername = localStorage.getItem('lastUser');
        if (savedUsername) {
          const cached = localStorage.getItem('kernel_cache');
          if (cached) {
             const data = JSON.parse(cached);
             const t = data.tenants.find((tn: Tenant) => tn.roomNumber === savedUsername);
             if (t) setCurrentUserTenant(t);
          }
        }
      }
    }
  }, [initKernel]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTenant) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPendingUpload({
        name: file.name,
        mimeType: file.type,
        data: base64String
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const confirmUpload = () => {
    if (!pendingUpload || !selectedTenant) return;
    const newDoc: TenantDocument = {
      id: `DOC-${Date.now()}`,
      name: pendingUpload.name,
      mimeType: pendingUpload.mimeType,
      data: pendingUpload.data,
      uploadDate: new Date().toISOString()
    };
    const updatedDocs = [...tenantDocs, newDoc];
    setTenantDocs(updatedDocs);
    localStorage.setItem(`docs_${selectedTenant.id}`, JSON.stringify(updatedDocs));
    setPendingUpload(null);
  };

  const cancelUpload = () => {
    setPendingUpload(null);
  };

  const deleteDoc = (docId: string) => {
    if (!selectedTenant) return;
    const updatedDocs = tenantDocs.filter(d => d.id !== docId);
    setTenantDocs(updatedDocs);
    localStorage.setItem(`docs_${selectedTenant.id}`, JSON.stringify(updatedDocs));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginData.username === 'admin' && loginData.password === '1234') {
      setUserRole(UserRole.ADMIN);
      setIsAuthenticated(true);
      localStorage.setItem('userRole', UserRole.ADMIN);
      localStorage.setItem('lastUser', 'admin');
    } else {
      const tenant = tenants.find(t => t.roomNumber === loginData.username);
      if (tenant) {
        setUserRole(UserRole.STAF);
        setCurrentUserTenant(tenant);
        setIsAuthenticated(true);
        localStorage.setItem('userRole', UserRole.STAF);
        localStorage.setItem('lastUser', loginData.username);
      } else {
        alert('เข้าสู่ระบบล้มเหลว: ข้อมูลประจำตัวไม่ถูกต้อง');
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setCurrentUserTenant(null);
    setSelectedTenant(null);
    localStorage.removeItem('userRole');
    localStorage.removeItem('lastUser');
    setShowPublicBooking(false);
    setActivePage('dashboard');
  };

  const handleSaveSettings = () => {
    setIsSavingSettings(true);
    localStorage.setItem('sheetId', sheetId);
    localStorage.setItem('scriptUrl', scriptUrl.trim());
    
    setTimeout(() => {
      setIsSavingSettings(false);
      alert('บันทึกการตั้งค่าสำเร็จ กำลังรีบูตระบบ...');
      initKernel();
    }, 1000);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    
    setIsSubmitting(true);
    const newBooking: Booking = {
      id: `BK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      roomNumber: selectedRoom.number,
      tenantName: bookingForm.name,
      phone: bookingForm.phone,
      bookingDate: new Date().toISOString(),
      moveInDate: bookingForm.moveInDate,
      status: 'Pending'
    };

    try {
      const result = await createBooking(newBooking);
      if (result.status === 'success') {
        alert(`สำเร็จ: ส่งคำขอจอง ${newBooking.id} แล้ว\nหมายเหตุ: เซิร์ฟเวอร์อาจใช้เวลาสักครู่ในการประมวลผล`);
        setSelectedRoom(null);
        setBookingForm({ name: '', phone: '', moveInDate: '' });
        initKernel();
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการส่งข้อมูล: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBookingStatus = async (id: string, status: 'Confirmed' | 'Cancelled') => {
    setIsUpdatingBooking(id);
    try {
      const result = await updateBookingStatus(id, status);
      if (result.status === 'success') {
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
        alert(`สำเร็จ: การจอง ${id} ถูกทำเครื่องหมายเป็น ${status === 'Confirmed' ? 'ยืนยันแล้ว' : 'ยกเลิกแล้ว'}`);
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการซิงค์ข้อมูล');
    } finally {
      setIsUpdatingBooking(null);
    }
  };

  const startEditingTenant = () => {
    if (selectedTenant) {
      setEditTenantForm({ ...selectedTenant });
      setIsEditingTenant(true);
    }
  };

  const cancelEditingTenant = () => {
    setIsEditingTenant(false);
    setEditTenantForm(null);
  };

  const submitTenantEdits = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSyncConfirm(true);
  };

  const finalizeTenantSync = async () => {
    if (!editTenantForm) return;
    setIsSyncingTenant(true);
    try {
      const res = await updateTenantInSheet(editTenantForm);
      if (res.status === 'success') {
        // Update local state
        setTenants(prev => prev.map(t => t.id === editTenantForm.id ? editTenantForm : t));
        setSelectedTenant(editTenantForm);
        setIsEditingTenant(false);
        setShowSyncConfirm(false);
        alert('ข้อมูลผู้เช่าถูกซิงค์ไปยัง KERNEL เรียบร้อยแล้ว');
      } else {
        alert('เกิดข้อผิดพลาดในการซิงค์ข้อมูลไปยัง KERNEL');
      }
    } catch (err) {
      alert('ไม่สามารถเชื่อมต่อกับ KERNEL ได้ในขณะนี้');
    } finally {
      setIsSyncingTenant(false);
    }
  };

  const runAiAnalysis = async () => {
    if (!aiTaskInput.trim()) return;
    setIsAiAnalyzing(true);
    setAiSuggestion(null);
    try {
      const suggestion = await suggestTaskDetails(aiTaskInput);
      setAiSuggestion(suggestion);
    } catch (e) {
      alert('AI Core ขัดข้อง: ไม่สามารถวิเคราะห์รายละเอียดงานได้');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const myInvoices = useMemo(() => {
    if (userRole === UserRole.ADMIN) return invoices;
    return invoices.filter(inv => inv.roomNumber === currentUserTenant?.roomNumber);
  }, [invoices, userRole, currentUserTenant]);

  const availableRooms = useMemo(() => rooms.filter(r => r.status === 'Available'), [rooms]);

  const getPriorityStyle = (priority: Task['priority'] | string) => {
    switch (priority) {
      case 'Critical': return { background: 'var(--mx-danger)', color: '#fff', icon: '⚠', weight: '900' };
      case 'High': return { color: '#ff9100', border: '1px solid #ff9100', icon: '↑' };
      case 'Medium': return { color: '#faff00', border: '1px solid #faff00', icon: '●' };
      case 'Low': return { color: 'var(--mx-green-2)', border: '1px solid var(--mx-green-2)', icon: '↓' };
      default: return { color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.2)', icon: '?' };
    }
  };

  const getRoomStatusStyles = (status: string) => {
    switch (status) {
      case 'Available': 
        return { 
          border: `1px solid ${COLORS.neonBlue}`, 
          shadow: `0 0 15px rgba(0, 212, 255, 0.2)`, 
          badgeClass: 'status-active',
          label: 'ว่าง',
          icon: '✨',
          cardBg: 'rgba(0, 212, 255, 0.05)'
        };
      case 'Occupied':
        return { 
          border: `1px solid rgba(255,255,255,0.1)`, 
          shadow: `none`, 
          badgeClass: '',
          label: 'ไม่ว่าง',
          icon: '👤',
          cardBg: 'rgba(255, 255, 255, 0.02)'
        };
      case 'Maintenance':
        return { 
          border: `1px solid ${COLORS.warning}`, 
          shadow: `0 0 15px rgba(250, 255, 0, 0.1)`, 
          badgeClass: '',
          label: 'ซ่อมบำรุง',
          icon: '🛠️',
          cardBg: 'rgba(250, 255, 0, 0.05)'
        };
      default: return { border: '1px solid var(--line)', shadow: 'none', badgeClass: '', label: status, icon: '', cardBg: 'transparent' };
    }
  };

  const renderBookingPage = () => (
    <div className="animate-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="card-title" style={{ color: 'var(--mx-green-2)' }}>เทอร์มินัลการจองห้องพัก</h2>
          <p className="text-xs opacity-50">สถานะความพร้อมของทรัพย์สินแบบเรียลไทม์</p>
        </div>
        {!isAuthenticated && (
          <button className="btn btn-secondary py-2" onClick={() => setShowPublicBooking(false)}>กลับไปหน้าเข้าสู่ระบบ</button>
        )}
      </div>

      <div className="dashboard-grid mb-10">
        {rooms.length > 0 ? (
          rooms.map(room => {
            const styles = getRoomStatusStyles(room.status);
            const isAvailable = room.status === 'Available';
            return (
              <div 
                key={room.id} 
                className={`dashboard-card transition-all ${isAvailable ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-70'} ${selectedRoom?.id === room.id ? 'ring-2 ring-inset ring-[#00d4ff]' : ''}`}
                style={{ 
                  border: styles.border, 
                  boxShadow: styles.shadow,
                  background: styles.cardBg 
                }}
                onClick={() => isAvailable && setSelectedRoom(room)}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`status-badge ${styles.badgeClass}`} style={!styles.badgeClass ? { background: 'rgba(255,255,255,0.1)', color: 'white' } : {}}>
                    {styles.icon} {styles.label.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono opacity-50">{room.type}</span>
                </div>
                <div className="card-value mb-1">{room.number}</div>
                <div className="text-xl font-bold" style={{ color: isAvailable ? COLORS.neonBlue : '#888' }}>
                  {room.price.toLocaleString()} <span className="text-xs font-normal opacity-50">บาท / เดือน</span>
                </div>
                {isAvailable ? (
                  <button className="btn w-full mt-6 py-2" style={{ fontSize: '10px' }}>เลือกยูนิตนี้</button>
                ) : (
                  <div className="text-[10px] text-center mt-6 opacity-40 font-bold uppercase tracking-widest">
                    {room.status === 'Maintenance' ? 'งดใช้ชั่วคราว' : 'มีผู้เข้าพักแล้ว'}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full p-20 text-center opacity-40 border border-dashed border-white/20 rounded-2xl">
            <p>ไม่พบข้อมูลยูนิตในฐานข้อมูล</p>
          </div>
        )}
      </div>

      {selectedRoom && (
        <div className="form-container animate-in border-t-4" style={{ borderColor: 'var(--mx-green-2)' }}>
          <h3 className="card-title mb-6">แบบฟอร์มการจอง: ยูนิต {selectedRoom.number}</h3>
          <form onSubmit={handleBookingSubmit} className="form-grid">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-full">
               <div>
                <label>ชื่อ-นามสกุล ผู้จอง</label>
                <input 
                  required
                  value={bookingForm.name}
                  onChange={e => setBookingForm({...bookingForm, name: e.target.value})}
                  placeholder="กรุณากรอกชื่อจริง"
                />
              </div>
              <div>
                <label>เบอร์โทรศัพท์ติดต่อ</label>
                <input 
                  required
                  value={bookingForm.phone}
                  onChange={e => setBookingForm({...bookingForm, phone: e.target.value})}
                  placeholder="0XX-XXX-XXXX"
                />
              </div>
              <div>
                <label>วันที่ต้องการเข้าอยู่</label>
                <input 
                  type="date"
                  required
                  value={bookingForm.moveInDate}
                  onChange={e => setBookingForm({...bookingForm, moveInDate: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex items-end">
                <button className="btn w-full py-4 shadow-[0_0_20px_rgba(0,212,255,0.3)]" disabled={isSubmitting}>
                  {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ยืนยันการจอง'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );

  const renderManageBookings = () => {
    if (userRole !== UserRole.ADMIN) return <div className="p-8 text-center opacity-50">ไม่อนุญาตให้เข้าถึง</div>;
    return (
      <div className="animate-in">
        <h2 className="card-title mb-6">คิวจัดการการจองห้องพัก</h2>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ผู้สมัคร</th>
                <th>ห้อง</th>
                <th>โทรศัพท์</th>
                <th>วันที่</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length > 0 ? bookings.map(b => (
                <tr key={b.id}>
                  <td>
                    <div className="font-bold text-sm">{b.tenantName}</div>
                    <div className="text-[10px] opacity-40 font-mono">{b.id}</div>
                  </td>
                  <td><span className="font-mono text-xs">{b.roomNumber}</span></td>
                  <td>{b.phone}</td>
                  <td>
                    <div className="text-[10px] opacity-60">จองเมื่อ: {new Date(b.bookingDate).toLocaleDateString('th-TH')}</div>
                    <div className="text-[10px] font-bold">เข้าอยู่: {new Date(b.moveInDate).toLocaleDateString('th-TH')}</div>
                  </td>
                  <td>
                    <span className={`status-badge ${b.status === 'Confirmed' ? 'status-active' : b.status === 'Cancelled' ? 'status-overdue' : ''}`} style={b.status === 'Pending' ? { border: '1px solid rgba(255,255,255,0.2)' } : {}}>
                      {b.status === 'Pending' ? 'รอดำเนินการ' : b.status === 'Confirmed' ? 'ยืนยันแล้ว' : 'ยกเลิกแล้ว'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {b.status === 'Pending' && (
                        <>
                          <button 
                            className="control-btn" 
                            style={{ borderColor: 'var(--mx-green)', color: 'var(--mx-green)' }} 
                            onClick={() => handleUpdateBookingStatus(b.id, 'Confirmed')}
                            disabled={isUpdatingBooking === b.id}
                          >
                            อนุมัติ
                          </button>
                          <button 
                            className="control-btn" 
                            style={{ borderColor: 'var(--mx-danger)', color: 'var(--mx-danger)' }} 
                            onClick={() => handleUpdateBookingStatus(b.id, 'Cancelled')}
                            disabled={isUpdatingBooking === b.id}
                          >
                            ยกเลิก
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="p-10 text-center opacity-30 italic">ไม่พบประวัติการจองในระบบ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTenantDetails = () => {
    if (!selectedTenant) return null;
    return (
      <div className="animate-in space-y-6">
        <div className="flex justify-between items-center">
          <button className="control-btn" onClick={() => { setSelectedTenant(null); setIsEditingTenant(false); }}>← ย้อนกลับ</button>
          <div className="flex gap-3">
            {!isEditingTenant && (
              <button className="control-btn" style={{ borderColor: 'var(--mx-green-2)' }} onClick={startEditingTenant}>แก้ไขข้อมูล</button>
            )}
            <h2 className="card-title" style={{ margin: 0 }}>แฟ้มข้อมูลผู้เช่า: {selectedTenant.name}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="dashboard-card col-span-1">
            <div className="flex justify-between items-center">
              <div className="card-title">{isEditingTenant ? 'แก้ไขข้อมูล' : 'ข้อมูลพื้นฐาน'}</div>
              {isEditingTenant && <span className="text-[10px] text-yellow-400 font-bold">โหมดแก้ไข</span>}
            </div>
            
            {isEditingTenant && editTenantForm ? (
              <form onSubmit={submitTenantEdits} className="space-y-4 mt-4 animate-in">
                <div>
                  <label className="text-[9px]">ชื่อ-นามสกุล</label>
                  <input 
                    value={editTenantForm.name} 
                    onChange={e => setEditTenantForm({...editTenantForm, name: e.target.value})}
                    className="py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[9px]">เบอร์โทรศัพท์</label>
                  <input 
                    value={editTenantForm.phone} 
                    onChange={e => setEditTenantForm({...editTenantForm, phone: e.target.value})}
                    className="py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[9px]">สถานะ</label>
                  <select 
                    value={editTenantForm.status} 
                    onChange={e => setEditTenantForm({...editTenantForm, status: e.target.value as any})}
                    className="py-2 text-sm"
                  >
                    <option value="Active">เข้าพักอยู่ (Active)</option>
                    <option value="Former">ย้ายออกแล้ว (Former)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px]">ระยะเวลาสัญญา</label>
                  <input 
                    value={editTenantForm.contractPeriod || ''} 
                    onChange={e => setEditTenantForm({...editTenantForm, contractPeriod: e.target.value})}
                    placeholder="เช่น 1 ปี"
                    className="py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button type="submit" className="btn py-2 px-4 flex-1 text-[10px]">บันทึก</button>
                  <button type="button" className="btn btn-secondary py-2 px-4 flex-1 text-[10px]" onClick={cancelEditingTenant}>ยกเลิก</button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 mt-4 text-sm">
                <div><span className="opacity-50">ไอดี:</span> <span className="font-mono">{selectedTenant.id}</span></div>
                <div><span className="opacity-50">ห้อง:</span> {selectedTenant.roomNumber}</div>
                <div><span className="opacity-50">เบอร์โทร:</span> {selectedTenant.phone}</div>
                <div><span className="opacity-50">วันที่เข้าพัก:</span> {selectedTenant.entryDate}</div>
                <div><span className="opacity-50">สถานะ:</span> <span className={`status-badge ${selectedTenant.status === 'Active' ? 'status-active' : ''}`}>{selectedTenant.status}</span></div>
                {selectedTenant.contractPeriod && <div><span className="opacity-50">สัญญา:</span> {selectedTenant.contractPeriod}</div>}
              </div>
            )}
          </div>

          <div className="dashboard-card col-span-2">
            <div className="flex justify-between items-center mb-4">
              <div className="card-title">เอกสารและไฟล์แนบ</div>
              {!pendingUpload && (
                <label className="btn py-2 px-4 cursor-pointer" style={{ fontSize: '10px' }}>
                  อัปโหลดเอกสารใหม่
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>

            {pendingUpload && (
              <div className="mb-6 p-4 border border-dashed border-[#00d4ff] bg-[#00d4ff]/5 rounded-xl animate-in">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] font-bold text-[#00d4ff] tracking-widest">ตรวจสอบข้อมูลก่อนซิงค์</div>
                  <div className="flex gap-2">
                    <button className="control-btn" style={{ borderColor: 'var(--mx-green)' }} onClick={confirmUpload}>ซิงค์ข้อมูล</button>
                    <button className="control-btn" style={{ borderColor: 'var(--mx-danger)' }} onClick={cancelUpload}>ยกเลิก</button>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4">
                  {pendingUpload.mimeType.startsWith('image/') ? (
                    <img src={pendingUpload.data} alt="preview" className="max-h-[200px] rounded-lg border border-white/10 shadow-lg" />
                  ) : (
                    <div className="p-8 bg-white/5 rounded-lg border border-white/10 text-center w-full">
                      <div className="text-3xl mb-2">📄</div>
                      <div className="text-xs font-mono opacity-60">ไฟล์ประเภทเอกสาร: {pendingUpload.name}</div>
                    </div>
                  )}
                  <div className="text-xs opacity-50 truncate w-full text-center">{pendingUpload.name}</div>
                </div>
              </div>
            )}
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {tenantDocs.length > 0 ? (
                tenantDocs.map(doc => (
                  <div key={doc.id} className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/20 rounded">📄</div>
                      <div>
                        <div className="text-xs font-bold truncate max-w-[200px]">{doc.name}</div>
                        <div className="text-[9px] opacity-40">{new Date(doc.uploadDate).toLocaleDateString('th-TH')}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="control-btn" style={{ borderColor: 'var(--mx-green-2)' }} onClick={() => setViewingDoc({ type: 'ไฟล์แนบ', data: doc })}>ดูไฟล์</button>
                      <button className="control-btn" style={{ borderColor: 'var(--mx-danger)' }} onClick={() => deleteDoc(doc.id)}>ลบ</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center opacity-30 italic text-xs border border-dashed border-white/10 rounded-lg">
                  ไม่พบข้อมูลไฟล์ดิจิทัลในแฟ้มข้อมูล
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTasks = () => {
    if (userRole !== UserRole.ADMIN) return <div className="p-8 text-center opacity-50">ไม่อนุญาตให้เข้าถึง</div>;
    
    const categories = ['All', 'Maintenance', 'Admin', 'Legal', 'Other'];
    const filteredTasks = taskCategoryFilter === 'All' 
      ? tasks 
      : tasks.filter(t => t.category === taskCategoryFilter);

    return (
      <div className="animate-in space-y-6">
        <div className="dashboard-card border-[#00d4ff]/30 shadow-[0_0_20px_rgba(0,212,255,0.1)]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="card-title" style={{ color: 'var(--mx-green-2)' }}>ผู้ช่วยอัจฉริยะ (AI TASK ASSISTANT)</h3>
            <span className="text-[9px] opacity-40 tracking-widest font-mono">GEMINI-CORE_V3</span>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <input 
                value={aiTaskInput}
                onChange={e => setAiTaskInput(e.target.value)}
                placeholder="บรรยายปัญหาที่พบ (เช่น 'หลอดไฟทางเดินตึก B เสีย อาจเป็นที่ระบบไฟฟ้า')"
                className="pr-32"
                onKeyPress={(e) => e.key === 'Enter' && runAiAnalysis()}
              />
              <button 
                className="absolute right-2 top-2 bottom-2 btn py-0 px-4" 
                style={{ fontSize: '10px', height: 'auto', background: 'var(--mx-green-2)' }}
                onClick={runAiAnalysis}
                disabled={isAiAnalyzing}
              >
                {isAiAnalyzing ? 'กำลังวิเคราะห์...' : 'เริ่มการวิเคราะห์'}
              </button>
            </div>

            {aiSuggestion && (
              <div className="p-4 bg-white/5 border border-[#00d4ff]/20 rounded-xl animate-in flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-1">
                  <div className="text-[10px] opacity-40 font-bold mb-2">ข้อเสนอแนะจากระบบ</div>
                  <div className="flex gap-3 items-center">
                    <div className="px-3 py-1 bg-[#00d4ff]/10 border border-[#00d4ff]/40 rounded text-xs font-bold text-[#00d4ff]">
                      {aiSuggestion.assignee.toUpperCase()}
                    </div>
                    <span 
                      className="status-badge flex items-center gap-1"
                      style={{ 
                        background: getPriorityStyle(aiSuggestion.priority).background || 'transparent', 
                        color: getPriorityStyle(aiSuggestion.priority).color, 
                        border: getPriorityStyle(aiSuggestion.priority).border || 'none'
                      }}
                    >
                      {getPriorityStyle(aiSuggestion.priority).icon} {aiSuggestion.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-3 text-xs italic opacity-70">" {aiSuggestion.reasoning} "</p>
                </div>
                <button className="btn w-full md:w-auto mt-4 md:mt-0" style={{ fontSize: '9px' }}>สร้างงานอัตโนมัติ</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="card-title" style={{ margin: 0 }}>งานบริหารจัดการอาคาร</h2>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map(cat => (
              <button 
                key={cat}
                className={`control-btn ${taskCategoryFilter === cat ? 'active' : ''}`}
                style={{ 
                  borderColor: taskCategoryFilter === cat ? 'var(--mx-green-2)' : 'var(--line)',
                  background: taskCategoryFilter === cat ? 'rgba(0, 212, 255, 0.1)' : 'transparent',
                  whiteSpace: 'nowrap'
                }}
                onClick={() => setTaskCategoryFilter(cat)}
              >
                {cat === 'All' ? 'ทั้งหมด' : cat === 'Maintenance' ? 'ซ่อมบำรุง' : cat === 'Admin' ? 'ธุรการ' : cat === 'Legal' ? 'กฎหมาย' : 'อื่นๆ'}
              </button>
            ))}
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>งาน</th>
                <th>ประเภท</th>
                <th>ผู้รับผิดชอบ</th>
                <th>ความสำคัญ</th>
                <th>สถานะ</th>
                <th>กำหนดส่ง</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length > 0 ? filteredTasks.map(task => {
                const pStyle = getPriorityStyle(task.priority);
                return (
                  <tr key={task.id}>
                    <td>
                      <div className="font-bold text-sm">{task.title}</div>
                      <div className="text-[10px] opacity-50 truncate max-w-xs">{task.description}</div>
                    </td>
                    <td>
                      <span className="text-[10px] opacity-60 font-mono tracking-widest">{task.category?.toUpperCase() || 'N/A'}</span>
                    </td>
                    <td><span className="text-xs font-mono">{task.assignee || 'ยังไม่มอบหมาย'}</span></td>
                    <td>
                      <span 
                        className="status-badge flex items-center gap-1 w-fit"
                        style={{ 
                          background: pStyle.background || 'transparent', 
                          color: pStyle.color, 
                          border: pStyle.border || 'none',
                          fontWeight: pStyle.weight || 'inherit'
                        }}
                      >
                        <span className="text-[10px]">{pStyle.icon}</span>
                        {task.priority.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${task.status === 'Completed' ? 'status-active' : ''}`} style={task.status !== 'Completed' ? { borderColor: 'rgba(255,255,255,0.1)', border: '1px solid' } : {}}>
                        {task.status === 'Pending' ? 'รอ' : task.status === 'In Progress' ? 'กำลังทำ' : task.status === 'Completed' ? 'เสร็จสิ้น' : 'ยกเลิก'}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{task.dueDate}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="p-10 text-center opacity-30 italic">ไม่พบงานในหมวดหมู่นี้</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderReports = () => {
    if (userRole !== UserRole.ADMIN) return <div className="p-8 text-center opacity-50">ไม่อนุญาตให้เข้าถึง</div>;
    
    // Aggregation Logic
    const totalTenants = tenants.length;
    const occupiedCount = rooms.filter(r => r.status === 'Occupied').length;
    const occupancyRate = rooms.length > 0 ? (occupiedCount / rooms.length * 100).toFixed(1) : 0;
    
    const upcomingBookings = bookings.filter(b => b.status === 'Confirmed' && new Date(b.moveInDate) >= new Date());
    const overdueInvoices = invoices.filter(i => i.status === 'Overdue');
    const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    
    const monthlyRevenue = invoices.filter(i => i.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0);

    return (
      <div className="animate-in space-y-8">
        <div className="flex justify-between items-end">
           <div>
              <h2 className="card-title" style={{ color: COLORS.neonBlue, fontSize: '1.2rem' }}>ระบบรายงานวิเคราะห์ข้อมูล (DATA ANALYTICS REPORT)</h2>
              <p className="text-xs opacity-50 uppercase tracking-widest mt-1">สรุปผลการดำเนินงานโครงสร้างพื้นฐาน</p>
           </div>
           <button className="control-btn" onClick={() => window.print()}>ออกรายงาน PDF</button>
        </div>

        <div className="dashboard-grid">
           <div className="dashboard-card border-[#00ff41]/20">
              <div className="card-title">อัตราการเข้าพัก (OCCUPANCY)</div>
              <div className="card-value" style={{ color: COLORS.matrixGreen }}>{occupancyRate}%</div>
              <div className="text-[10px] opacity-40 mt-2">{occupiedCount} จาก {rooms.length} ยูนิต</div>
           </div>
           <div className="dashboard-card border-[#ff3131]/20">
              <div className="card-title">ยอดค้างชำระรวม (OVERDUE)</div>
              <div className="card-value" style={{ color: COLORS.danger }}>{totalOverdueAmount.toLocaleString()} <span className="text-sm">บาท</span></div>
              <div className="text-[10px] opacity-40 mt-2">{overdueInvoices.length} รายการที่เกินกำหนด</div>
           </div>
           <div className="dashboard-card border-[#00d4ff]/20">
              <div className="card-title">รายได้ที่รับชำระแล้ว (REVENUE)</div>
              <div className="card-value" style={{ color: COLORS.neonBlue }}>{monthlyRevenue.toLocaleString()} <span className="text-sm">บาท</span></div>
              <div className="text-[10px] opacity-40 mt-2">ยอดสะสมทั้งหมดในระบบ</div>
           </div>
           <div className="dashboard-card border-[#faff00]/20">
              <div className="card-title">ผู้เช่าปัจจุบัน (TENANTS)</div>
              <div className="card-value" style={{ color: COLORS.warning }}>{totalTenants} <span className="text-sm">คน</span></div>
              <div className="text-[10px] opacity-40 mt-2">จำนวนสมาชิกในโครงการ</div>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="table-container">
              <h3 className="card-title p-4">การจองที่กำลังจะเข้าพัก (UPCOMING MOVE-INS)</h3>
              <table>
                 <thead>
                    <tr><th>ชื่อผู้เช่า</th><th>ห้อง</th><th>วันที่เข้าพัก</th></tr>
                 </thead>
                 <tbody>
                    {upcomingBookings.length > 0 ? upcomingBookings.map(b => (
                       <tr key={b.id}>
                          <td className="font-bold text-xs">{b.tenantName}</td>
                          <td className="font-mono text-xs">{b.roomNumber}</td>
                          <td className="text-xs">{new Date(b.moveInDate).toLocaleDateString('th-TH')}</td>
                       </tr>
                    )) : (
                       <tr><td colSpan={3} className="p-8 text-center opacity-30 italic">ไม่พบรายการจองที่รอเข้าพัก</td></tr>
                    )}
                 </tbody>
              </table>
           </div>

           <div className="table-container">
              <h3 className="card-title p-4">ใบแจ้งหนี้ค้างชำระ (OVERDUE INVOICES)</h3>
              <table>
                 <thead>
                    <tr><th>ห้อง</th><th>รอบเดือน</th><th>จำนวนเงิน</th></tr>
                 </thead>
                 <tbody>
                    {overdueInvoices.length > 0 ? overdueInvoices.map(i => (
                       <tr key={i.id}>
                          <td className="font-mono text-xs">{i.roomNumber}</td>
                          <td className="text-xs">{i.month}</td>
                          <td className="font-bold text-xs text-red-400">{i.amount.toLocaleString()} บาท</td>
                       </tr>
                    )) : (
                       <tr><td colSpan={3} className="p-8 text-center opacity-30 italic">ไม่มีค้างชำระ</td></tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>

        <div className="dashboard-card border-white/5 bg-white/[0.02]">
           <div className="card-title">บทวิเคราะห์โดยสังเขป (EXECUTIVE SUMMARY)</div>
           <p className="text-xs leading-relaxed opacity-70 mt-4">
              ปัจจุบันโครงการมีอัตราการเข้าพักที่ {occupancyRate}% โดยมียอดค้างชำระรวม {totalOverdueAmount.toLocaleString()} บาท 
              จากการวิเคราะห์ข้อมูลพบว่ามีรายการจองใหม่จำนวน {upcomingBookings.length} รายการที่กำลังรอเข้าพัก 
              ซึ่งจะช่วยเพิ่มอัตราการเข้าพักในอนาคตอันใกล้ แนะนำให้เจ้าหน้าที่เร่งตรวจสอบใบแจ้งหนี้ที่เกินกำหนด {overdueInvoices.length} รายการเพื่อรักษาสภาพคล่องของโครงการ
           </p>
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const isAdmin = userRole === UserRole.ADMIN;
    return (
      <div className="animate-in">
        <h2 className="card-title mb-6" style={{ color: isAdmin ? 'var(--mx-green)' : 'var(--mx-green-2)' }}>
          {isAdmin ? 'ศูนย์ควบคุมระบบ (ADMIN COMMAND CENTER)' : `พอร์ทัลผู้เช่า - ห้อง ${currentUserTenant?.roomNumber}`}
        </h2>
        
        <div className="dashboard-grid">
          {isAdmin ? (
            <>
              <div className="dashboard-card"><div className="card-title">ผู้เช่าทั้งหมด</div><div className="card-value">{tenants.length}</div></div>
              <div className="dashboard-card"><div className="card-title">คำขอจองรออนุมัติ</div><div className="card-value" style={{ color: '#faff00' }}>{bookings.filter(b => b.status === 'Pending').length}</div></div>
              <div className="dashboard-card"><div className="card-title">สถานะระบบ</div><div className="card-value" style={{ fontSize: '1rem', color: kernelStatus === 'CONNECTED' ? 'var(--mx-green)' : 'var(--mx-danger)' }}>{kernelStatus === 'CONNECTED' ? 'เชื่อมต่อแล้ว' : 'ขัดข้อง'}</div></div>
            </>
          ) : (
            <>
              <div className="dashboard-card"><div className="card-title">ชื่อผู้เช่า</div><div className="card-value" style={{ fontSize: '1.2rem' }}>{currentUserTenant?.name}</div></div>
              <div className="dashboard-card"><div className="card-title">หมายเลขห้อง</div><div className="card-value">{currentUserTenant?.roomNumber}</div></div>
              <div className="dashboard-card"><div className="card-title">ยอดค้างชำระ</div><div className="card-value" style={{ color: '#ff3131' }}>{myInvoices.filter(i => i.status !== 'Paid').reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()} บาท</div></div>
            </>
          )}
        </div>

        <div className="table-container mt-6">
          <h3 className="card-title p-4">{isAdmin ? 'ประวัติใบแจ้งหนี้ทั้งหมด' : 'ประวัติการชำระเงินของฉัน'}</h3>
          <table>
            <thead>
              <tr>
                <th>รอบเดือน</th>
                {isAdmin && <th>ห้อง</th>}
                <th>จำนวนเงิน</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {myInvoices.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.month}</td>
                  {isAdmin && <td>{inv.roomNumber}</td>}
                  <td>{inv.amount.toLocaleString()}</td>
                  <td>
                    <span className={`status-badge ${inv.status === 'Paid' ? 'status-active' : 'status-overdue'}`}>
                      {inv.status === 'Paid' ? 'ชำระแล้ว' : inv.status === 'Unpaid' ? 'ยังไม่ชำระ' : 'เกินกำหนด'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="control-btn" 
                      style={{ borderColor: 'var(--mx-green-2)', color: 'var(--mx-green-2)' }}
                      onClick={() => setViewingDoc({ type: 'ใบแจ้งหนี้', data: inv })}
                    >
                      ดูใบเสร็จ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderTenants = () => {
    if (userRole !== UserRole.ADMIN) return <div className="p-8 text-center opacity-50">ไม่อนุญาตให้เข้าถึง</div>;
    if (selectedTenant) return renderTenantDetails();

    return (
      <div className="animate-in">
        <h2 className="card-title mb-6">ฐานข้อมูลผู้เช่าทั้งหมด</h2>
        <div className="table-container">
          <table>
            <thead><tr><th>ชื่อ-นามสกุล</th><th>ห้อง</th><th>โทรศัพท์</th><th>จัดการ</th></tr></thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.roomNumber}</td>
                  <td>{t.phone}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="control-btn" style={{ borderColor: 'var(--mx-green-2)' }} onClick={() => setSelectedTenant(t)}>รายละเอียด</button>
                      <button className="control-btn" onClick={() => setViewingDoc({ type: 'สัญญาเช่า', data: t })}>ดูสัญญา</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAdminSettings = () => {
    if (userRole !== UserRole.ADMIN) return <div className="p-8 text-center opacity-50">ไม่อนุญาตให้เข้าถึง</div>;
    return (
      <div className="animate-in">
        <h2 className="card-title mb-6">การตั้งค่าระบบ (KERNEL CONFIGURATION)</h2>
        <div className="form-container max-w-2xl mx-auto">
          <div className="space-y-6">
            <div>
              <label>SPREADSHEET IDENTIFIER (ID ของชีท)</label>
              <input 
                value={sheetId}
                onChange={e => setSheetId(e.target.value)}
                placeholder="Database ID"
              />
              <p className="text-[10px] opacity-40 mt-1">คัดลอกจาก URL ของ Google Sheet</p>
            </div>
            <div>
              <label>GOOGLE APPS SCRIPT ENDPOINT</label>
              <input 
                value={scriptUrl}
                onChange={e => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/..."
              />
              <p className="text-[10px] opacity-40 mt-1">URL ที่ได้จากการ deploy Web App</p>
            </div>
            <div className="pt-4">
              <button 
                className="btn w-full py-4 shadow-[0_0_20px_rgba(0,255,65,0.2)]"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                style={{ background: 'var(--mx-green)' }}
              >
                {isSavingSettings ? 'กำลังบันทึก...' : 'บันทึกและรีบูตระบบ'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (kernelStatus === 'ERROR' && !isAuthenticated && !showPublicBooking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <MatrixRain />
        <div className="form-container w-full max-w-lg relative z-10 animate-in border-red-500/50">
          <div className="text-center mb-8">
            <h1 className="logo text-red-500" style={{ fontSize: '1.5rem', background: 'none', WebkitTextFillColor: '#ff3131' }}>การเชื่อมต่อขัดข้อง (KERNEL_SYNC_FAILURE)</h1>
            <p className="text-[10px] opacity-60 mt-2 tracking-[2px]">ไม่สามารถเชื่อมต่อกับโครงสร้างพื้นฐานของ GOOGLE ได้</p>
          </div>
          
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6 text-xs leading-relaxed">
            <p className="font-bold mb-2 text-red-400">รายงานความผิดพลาด:</p>
            <p className="text-xs font-mono mb-4 text-red-300">{kernelErrorMessage}</p>
            <ul className="list-disc pl-4 space-y-1 opacity-80 text-[10px]">
              <li><b>CORS POLICY:</b> ตรวจสอบว่าได้ตั้งค่า Web App เป็น "Anyone" หรือยัง</li>
              <li><b>ACCESS DENIED:</b> สคริปต์ต้องได้รับอนุญาตให้เข้าถึง Google Sheet</li>
              <li><b>INVALID URL:</b> ตรวจสอบว่า URL ของสคริปต์ลงท้ายด้วย <code>/exec</code> หรือไม่</li>
              <li><b>NETWORK:</b> ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือไฟร์วอลล์</li>
            </ul>
          </div>

          <div className="space-y-3">
             <button className="btn w-full py-4" onClick={initKernel} style={{ background: 'var(--mx-green)' }}>ลองอีกครั้ง</button>
             <button className="btn btn-secondary w-full py-4" onClick={() => { setIsAuthenticated(true); setUserRole(UserRole.ADMIN); setActivePage('admin'); }}>ข้ามไปยังหน้าตั้งค่าระบบ</button>
          </div>
          
          {lastSync && (
            <p className="text-center mt-6 text-[9px] opacity-40 uppercase tracking-widest">
              ซิงค์สำเร็จครั้งล่าสุดเมื่อ: {new Date(lastSync).toLocaleString('th-TH')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !showPublicBooking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <MatrixRain />
        <div className="form-container w-full max-w-md relative z-10 animate-in" style={{ border: '1px solid var(--mx-green)' }}>
          <div className="text-center mb-8">
            <h1 className="logo" style={{ fontSize: '2rem' }}>SW.BERNHARDT</h1>
            <p className="text-xs opacity-60 mt-2 tracking-[4px]">ระบบปฏิบัติการบริหารบ้านเช่า</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label>รหัสผู้ใช้ / หมายเลขห้อง</label>
              <input 
                value={loginData.username}
                onChange={e => setLoginData({...loginData, username: e.target.value})}
                placeholder="ชื่อผู้ใช้"
                required
              />
            </div>
            <div>
              <label>รหัสผ่าน</label>
              <input 
                type="password"
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
                placeholder="••••••••"
                required
              />
            </div>
            <button className="btn w-full py-4 mt-6" style={{ background: 'var(--mx-green)' }}>เข้าสู่ระบบ</button>
            <div className="flex items-center gap-4 mt-6">
              <div className="h-[1px] bg-white/10 flex-1"></div>
              <span className="text-[10px] opacity-40">สำหรับบุคคลภายนอก</span>
              <div className="h-[1px] bg-white/10 flex-1"></div>
            </div>
            <button 
              type="button"
              className="btn btn-secondary w-full py-4"
              onClick={() => setShowPublicBooking(true)}
            >
              ดูห้องพักที่ว่างอยู่
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <MatrixRain />
      {scannerEnabled && <div className="scanner"></div>}
      
      {(isAuthenticated || showPublicBooking) && (
        <nav className="main-nav" style={{ borderBottomColor: userRole === UserRole.ADMIN ? 'rgba(0, 255, 65, 0.4)' : 'rgba(0, 212, 255, 0.4)' }}>
          <div className="logo" onClick={() => setActivePage('dashboard')} style={{ cursor: 'pointer' }}>SW.BERNHARDT</div>
          <div className="nav-menu">
            {isAuthenticated ? (
              <>
                <div className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`} onClick={() => setActivePage('dashboard')}>แผงควบคุม</div>
                {userRole === UserRole.ADMIN && (
                  <>
                    <div className={`nav-item ${activePage === 'tenants' ? 'active' : ''}`} onClick={() => { setActivePage('tenants'); setSelectedTenant(null); }}>ผู้เช่า</div>
                    <div className={`nav-item ${activePage === 'manage-bookings' ? 'active' : ''}`} onClick={() => setActivePage('manage-bookings')}>การจอง</div>
                    <div className={`nav-item ${activePage === 'tasks' ? 'active' : ''}`} onClick={() => setActivePage('tasks')}>งาน</div>
                    <div className={`nav-item ${activePage === 'reports' ? 'active' : ''}`} onClick={() => setActivePage('reports')}>รายงาน</div>
                    <div className={`nav-item ${activePage === 'admin' ? 'active' : ''}`} onClick={() => setActivePage('admin')}>ระบบ</div>
                  </>
                )}
                <div className={`nav-item ${activePage === 'booking' ? 'active' : ''}`} onClick={() => setActivePage('booking')}>จองห้องพัก</div>
              </>
            ) : (
              <div className="nav-item active">ดูประกาศห้องพัก</div>
            )}
          </div>
          <div className="user-info">
            <button onClick={handleLogout} className="control-btn" style={{ fontSize: '9px' }}>
              {isAuthenticated ? 'ออกจากระบบ' : 'กลับหน้าแรก'}
            </button>
            <div className="user-avatar" style={{ background: userRole === UserRole.ADMIN ? 'var(--mx-green)' : 'var(--mx-green-2)' }}>
              {userRole ? userRole[0].toUpperCase() : 'P'}
            </div>
          </div>
        </nav>
      )}

      <main className="content">
        {!isAuthenticated && showPublicBooking ? renderBookingPage() : 
         activePage === 'dashboard' ? renderDashboard() : 
         activePage === 'booking' ? renderBookingPage() :
         activePage === 'manage-bookings' ? renderManageBookings() :
         activePage === 'tenants' ? renderTenants() : 
         activePage === 'tasks' ? renderTasks() :
         activePage === 'reports' ? renderReports() :
         activePage === 'admin' ? renderAdminSettings() :
         <div className="p-8 text-center">ไม่พบหน้านี้</div>}
      </main>

      {/* Sync Confirmation Modal */}
      {showSyncConfirm && (
        <div className="modal-overlay" style={{ zIndex: 110 }}>
          <div className="modal-container p-8 border-[#faff00]/50 shadow-[0_0_30px_rgba(250,255,0,0.15)] max-w-sm">
             <div className="text-center">
                <div className="text-3xl mb-4">🔄</div>
                <h3 className="card-title" style={{ color: COLORS.warning }}>ยืนยันการเปลี่ยนแปลง (SYNC CONFIRM)</h3>
                <p className="text-xs opacity-70 mb-6">คุณกำลังจะเขียนทับข้อมูลในฐานข้อมูลหลัก (KERNEL) ด้วยข้อมูลที่แก้ไขใหม่ ยืนยันการดำเนินการหรือไม่?</p>
                
                <div className="flex gap-3">
                   <button 
                    className="btn flex-1 py-3" 
                    style={{ background: COLORS.warning, color: '#000' }}
                    onClick={finalizeTenantSync}
                    disabled={isSyncingTenant}
                   >
                     {isSyncingTenant ? 'กำลังซิงค์...' : 'ยืนยัน'}
                   </button>
                   <button 
                    className="btn btn-secondary flex-1 py-3"
                    onClick={() => setShowSyncConfirm(false)}
                    disabled={isSyncingTenant}
                   >
                     ย้อนกลับ
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Document View Modal */}
      {viewingDoc && (
        <div className="modal-overlay">
          <div className="modal-container dark p-10 max-w-2xl" id="printable-doc">
            <button className="close-modal no-print" onClick={() => setViewingDoc(null)}>&times;</button>
            <div className="document-header flex justify-between items-start border-b border-white/20 pb-6 mb-8">
              <div>
                <h1 style={{ color: 'var(--mx-green-2)', margin: 0 }}>SW.BERNHARDT</h1>
                <p className="text-xs opacity-50">เอกสารอย่างเป็นทางการของโครงการ</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{viewingDoc.type.toUpperCase()}</p>
                <p className="text-xs opacity-50">อ้างอิง: {Math.random().toString(36).substring(7).toUpperCase()}</p>
              </div>
            </div>
            
            <div className="document-body space-y-6">
              {viewingDoc.type === 'ใบแจ้งหนี้' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="mb-0 opacity-50">ชื่อห้องพัก</label><p className="font-bold">ยูนิต {viewingDoc.data.roomNumber}</p></div>
                    <div><label className="mb-0 opacity-50">รอบบิล</label><p className="font-mono">{viewingDoc.data.month}</p></div>
                  </div>
                  <table className="mt-8">
                    <thead style={{ background: 'transparent' }}>
                      <tr className="border-b border-white/10"><th className="pl-0">รายการ</th><th className="text-right pr-0">จำนวนเงิน</th></tr>
                    </thead>
                    <tbody>
                      <tr><td className="pl-0">ค่าเช่าห้องพักประจำเดือน - {viewingDoc.data.month}</td><td className="text-right pr-0 font-bold">{viewingDoc.data.amount.toLocaleString()} บาท</td></tr>
                      <tr><td className="pl-0">ค่าบริการส่วนกลางและสิ่งอำนวยความสะดวก</td><td className="text-right pr-0 font-bold">รวมอยู่ในค่าเช่าแล้ว</td></tr>
                    </tbody>
                  </table>
                  <div className="mt-8 pt-8 border-t border-dashed border-white/10">
                     <p className="text-xs">สถานะการชำระเงิน: <span style={{ color: viewingDoc.data.status === 'Paid' ? 'var(--mx-green)' : 'var(--mx-danger)' }}>{viewingDoc.data.status === 'Paid' ? 'ชำระแล้ว' : 'ค้างชำระ'}</span></p>
                  </div>
                </>
              ) : viewingDoc.type === 'ไฟล์แนบ' ? (
                <div className="space-y-4 text-center">
                  <p className="text-xs opacity-50 mb-4">{viewingDoc.data.name} (อัปโหลดเมื่อ: {new Date(viewingDoc.data.uploadDate).toLocaleString('th-TH')})</p>
                  {viewingDoc.data.mimeType.startsWith('image/') ? (
                    <img src={viewingDoc.data.data} alt={viewingDoc.data.name} className="max-w-full rounded-lg border border-white/10 mx-auto" />
                  ) : (
                    <div className="p-20 border border-dashed border-white/10 rounded-lg">
                      <p className="text-xs opacity-50">ไม่สามารถแสดงตัวอย่างไฟล์ประเภทนี้ได้</p>
                      <a href={viewingDoc.data.data} download={viewingDoc.data.name} className="btn mt-4 inline-block">ดาวน์โหลดไฟล์</a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                   <p className="text-sm leading-relaxed">การตรวจสอบสัญญาเช่าสำหรับคุณ <b>{viewingDoc.data.name}</b> ณ <b>ห้อง {viewingDoc.data.roomNumber}</b> เอกสารนี้ใช้เพื่อยืนยันการพักอาศัยภายใต้การดูแลของ SW.BERNHARDT</p>
                   <div className="p-4 bg-white/5 border border-dashed border-white/20 text-[10px] font-mono opacity-60 break-all">
                     SYNC_ID: {viewingDoc.data.id}
                     <br/>
                     HASH: {btoa(viewingDoc.data.name + viewingDoc.data.roomNumber).substring(0, 32)}
                   </div>
                </div>
              )}
            </div>

            <div className="mt-12 pt-8 border-t border-white/10 flex justify-between items-end no-print">
              <div className="text-[10px] opacity-40 uppercase tracking-widest">Digital Kernel Verified</div>
              <div className="flex gap-2">
                <button className="btn btn-secondary py-2 px-4" onClick={() => window.print()}>พิมพ์เอกสาร</button>
                <button className="btn py-2 px-4" onClick={() => setViewingDoc(null)}>ปิด</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="controls no-print">
        <button className="control-btn" onClick={() => setScannerEnabled(!scannerEnabled)}>สแกนเนอร์ {scannerEnabled ? 'ปิด' : 'เปิด'}</button>
      </div>
      
      <footer style={{ position: 'fixed', bottom: 0, width: '100%', padding: '10px', textAlign: 'center', background: 'rgba(0,0,0,0.9)', borderTop: '1px solid var(--line)', zIndex: 10 }}>
        <p style={{ fontSize: '9px', color: 'var(--mx-green)', opacity: 0.5, letterSpacing: '2px' }}>&copy; 2025 SW.BERNHARDT INFRASTRUCTURE OS</p>
      </footer>
    </div>
  );
};

export default App;
