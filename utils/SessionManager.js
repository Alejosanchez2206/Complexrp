const fs = require('fs').promises;
const path = require('path');

class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.SESSION_TIMEOUT = 80 * 60 * 1000; // 80 minutos
        this.sessionStoragePath = path.join(__dirname, '../data/sessions');
        this.init();
    }

    async init() {
        try {
            await fs.access(this.sessionStoragePath);
        } catch {
            await fs.mkdir(this.sessionStoragePath, { recursive: true });
        }
        await this.cleanupExpiredSessions();
    }

    async cleanupExpiredSessions() {
        try {
            const files = await fs.readdir(this.sessionStoragePath);
            const now = Date.now();
            for (const file of files) {
                if (!file.endsWith('_session.json')) continue;
                const userId = file.split('_')[0];
                const filePath = path.join(this.sessionStoragePath, file);
                try {
                    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    if (now - data.timestamp > this.SESSION_TIMEOUT) {
                        await fs.unlink(filePath);
                        this.sessions.delete(userId);
                    }
                } catch (err) {
                    console.error(`Error al leer sesión ${userId}:`, err);
                }
            }
        } catch (err) {
            console.error('Error al limpiar sesiones caducadas:', err);
        }
    }

    async createSession(userId, data) {
        const session = {
            ...data,
            timestamp: Date.now(),
        };
        const filePath = path.join(this.sessionStoragePath, `${userId}_session.json`);
        await fs.writeFile(filePath, JSON.stringify(session, null, 2));
        this.sessions.set(userId, session);

        setTimeout(() => {
            if (this.sessions.has(userId)) {
                this.cleanSession(userId);
            }
        }, this.SESSION_TIMEOUT);
    }

    async getSession(userId) {
        const filePath = path.join(this.sessionStoragePath, `${userId}_session.json`);
        try {
            await fs.access(filePath);
            const rawData = await fs.readFile(filePath, 'utf8');
            const sessionData = JSON.parse(rawData);

            if (Date.now() - sessionData.timestamp > this.SESSION_TIMEOUT) {
                await this.cleanSession(userId);
                return null;
            }

            // Actualizar timestamp de acceso
            sessionData.timestamp = Date.now();
            this.sessions.set(userId, sessionData);
            await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));

            return sessionData;
        } catch {
            return null;
        }
    }

    async updateSession(userId, data) {
        const currentSession = await this.getSession(userId);
        if (!currentSession) return false;

        const updatedSession = {
            ...currentSession,
            ...data,
            timestamp: Date.now(),
        };

        const filePath = path.join(this.sessionStoragePath, `${userId}_session.json`);
        try {
            await fs.writeFile(filePath, JSON.stringify(updatedSession, null, 2));
            this.sessions.set(userId, updatedSession);
            return true;
        } catch {
            return false;
        }
    }

    async cleanSession(userId) {
        const filePath = path.join(this.sessionStoragePath, `${userId}_session.json`);
        try {
            await fs.unlink(filePath);
        } catch {}
        this.sessions.delete(userId);
    }
}

module.exports = new SessionManager();