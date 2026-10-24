import React from '../../frontend/node_modules/react/index.js';
import { renderToStaticMarkup } from '../../frontend/node_modules/react-dom/server.node.js';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ session: { user: { id: 'super', name: 'Super Admin', role: 'SUPER_ADMIN', branchId: undefined as string | undefined }, activeBranchId: 'branch-2' } }));
vi.mock('../../frontend/src/services/index.ts', () => ({ USE_MOCK: false, authService: { getCurrentSession: () => state.session }, salonService: {} }));
vi.mock('../../frontend/src/context/RouterContext.tsx', () => ({ useRouter: () => ({ navigate: vi.fn() }) }));
vi.mock('../../frontend/src/context/ToastContext.tsx', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }), toast: { error: vi.fn(), success: vi.fn() } }));
import { AuthProvider, useAuth } from '../../frontend/src/context/AuthContext';
import { Header } from '../../frontend/src/components/layout/Header';
import { BranchActionField } from '../../frontend/src/components/BranchActionField';
const wrap = (child: React.ReactNode) => renderToStaticMarkup(<AuthProvider>{child}</AuthProvider>);
function Scope() { const auth = useAuth(); return <span>{auth.activeBranchId}</span>; }
describe('manual action branches', () => {
 it('ignores a persisted global branch for Super Admin', () => { state.session.user.role = 'SUPER_ADMIN'; expect(wrap(<Scope />)).toBe('<span>ALL</span>'); });
 it('removes the global header branch selector and retains Reset Data', () => { state.session.user.role = 'SUPER_ADMIN'; const html = wrap(<Header isSidebarCollapsed={false} onToggleSidebar={() => {}} onOpenMobileDrawer={() => {}} breadcrumbs={[]} />); expect(html).toContain('Reset Data'); expect(html).not.toContain('Select Active Branch Scope'); expect(html).not.toContain('All Branches (Consolidated)'); expect(html).not.toContain('Assigned Branch'); });
 it('shows a required styled empty action dropdown for Super Admin', () => { state.session.user.role = 'SUPER_ADMIN'; const html = wrap(<BranchActionField value="" onChange={() => {}} />); expect(html).toContain('Select branch for this action'); expect(html).toContain('role="combobox"'); expect(html).toContain('aria-required="true"'); });
 it('keeps Admin locked to its assigned branch', () => { state.session.user.role = 'ADMIN'; state.session.user.branchId = 'branch-1'; expect(wrap(<Scope />)).toBe('<span>branch-1</span>'); expect(wrap(<BranchActionField value="" onChange={() => {}} />)).toBe(''); state.session.user.role = 'SUPER_ADMIN'; state.session.user.branchId = undefined; });
});
