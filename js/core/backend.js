/* =========================================================
   LE POINT DE BRANCHEMENT
   Si js/config.js contient l'adresse et la clé Supabase,
   tout passe par la base en ligne (backend-remote.js).
   Sinon, mode aperçu : tout reste sur l'appareil (backend-local.js).
   Les pages appellent toujours les mêmes fonctions.
   ========================================================= */
import { enabled } from "./sb.js";
import * as L from "./backend-local.js";
import * as R from "./backend-remote.js";

const B = enabled ? R : L;
const none = () => { throw new Error("local"); };

export const BACKEND_MODE = B.BACKEND_MODE;
export const isEmail = B.isEmail;

/* Comptes clients */
export const ready = () => B.ready();
export const signUp = (a) => B.signUp(a);
export const signIn = (a) => B.signIn(a);
export const signOut = () => B.signOut();
export const currentUser = () => B.currentUser();
export const updateUser = (p) => B.updateUser(p);
export const recover = (e) => B.recover(e);
export const updatePassword = (p) => B.updatePassword(p);

/* Commandes (à attendre avec await : en ligne, elles passent par le serveur) */
export const createOrder = (o) => B.createOrder(o);
export const myOrders = () => B.myOrders();
export const subscribe = (e, s, l) => B.subscribe(e, s, l);

/* Salon privé */
export const loadAdminData = () => B.loadAdminData();
export const allOrders = () => B.allOrders();
export const customers = () => B.customers();
export const subscribers = () => B.subscribers();
export const hasDemo = () => B.hasDemo();
export const updateOrder = (id, p) => B.updateOrder(id, p);
export const setOrderStatus = (id, s, pay) => (enabled ? R.setOrderStatus(id, s, pay) : none());
export const adminCreateOrder = (o) => (enabled ? R.adminCreateOrder(o) : L.createOrder(o));
export const unsubscribe = (e) => B.unsubscribe(e);
export const seedDemo = (p) => B.seedDemo(p);
export const clearDemo = () => B.clearDemo();
export const isAdmin = () => (enabled ? R.isAdmin() : Promise.resolve(false));
