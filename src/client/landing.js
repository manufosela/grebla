/**
 * Glue de la home: decide qué se ve según haya o no tenant en la URL.
 *  - Sin /{tenant} (raíz de plataforma): landing pública (presentación + login).
 *  - Dentro de /{tenant}: tarjetas de herramientas (layout.js ya prefija sus
 *    enlaces con /{tenant}).
 * Por defecto el HTML muestra la landing y oculta las tools; así la raíz nunca
 * expone herramientas sin un tenant concreto, aunque el JS no llegue a ejecutarse.
 */
import { onUserChanged, isAdmin } from '../lib/auth.js';
import { db } from '../lib/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

const RESERVED = new Set(['', 'guia', 'login', 'tools', '_astro']);

const seg = location.pathname.split('/')[1] || '';
const tenant = seg && !RESERVED.has(seg) ? seg : null;

const landing = document.getElementById('platform-landing');
const tools = document.getElementById('tenant-tools');
const myOrgs = document.getElementById('my-orgs');
const myOrgsList = document.getElementById('my-orgs-list');

if (tenant) {
  // Dentro de /{tenant}: mostrar las herramientas del tenant.
  tools?.removeAttribute('hidden');
  landing?.setAttribute('hidden', '');
} else {
  // Raíz de plataforma: si hay sesión, mostrar las organizaciones del usuario.
  onUserChanged(async (user) => {
    if (!user) return showPublicLanding();
    try {
      const { superAdmin, list } = await loadOrgs(user);
      if (list.length === 0) return showPublicLanding();
      // Un único tenant y no super-admin → directo a su organización.
      if (list.length === 1 && !superAdmin) {
        location.replace(`/${list[0].slug}`);
        return;
      }
      renderOrgs(list);
      landing?.setAttribute('hidden', '');
      myOrgs?.removeAttribute('hidden');
    } catch {
      showPublicLanding();
    }
  });
}

function showPublicLanding() {
  myOrgs?.setAttribute('hidden', '');
  landing?.removeAttribute('hidden');
}

/** @param {import('firebase/auth').User} user */
async function loadOrgs(user) {
  // Super-admin de plataforma: ve TODOS los tenants (gestión/soporte).
  if (await isAdmin(user.uid)) {
    const snap = await getDocs(collection(db, 'tenants'));
    return {
      superAdmin: true,
      list: snap.docs.map((d) => ({ slug: d.data().slug, name: d.data().name || d.data().slug })),
    };
  }
  // Member: sus organizaciones desde el índice inverso /userTenants/{uid}/tenants.
  const snap = await getDocs(collection(db, 'userTenants', user.uid, 'tenants'));
  return {
    superAdmin: false,
    list: snap.docs.map((d) => ({ slug: d.data().slug, name: d.data().slug })),
  };
}

/** @param {{slug:string,name:string}[]} list */
function renderOrgs(list) {
  if (!myOrgsList) return;
  myOrgsList.replaceChildren();
  for (const org of list.filter((o) => o.slug)) {
    const a = document.createElement('a');
    a.href = `/${org.slug}`;
    a.className = 'org-card';
    a.textContent = org.name || org.slug;
    myOrgsList.appendChild(a);
  }
}
