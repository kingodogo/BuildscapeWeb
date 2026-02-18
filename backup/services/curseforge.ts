import { AppConfig } from "../types";

const API_BASE = '/api/admin/curseforge';

export interface CurseForgeGameVersion {
  id: number;
  gameVersionTypeID: number;
  name: string;
  slug: string;
}

export interface CurseForgeDependency {
  id: number;
  name: string;
  slug: string;
}

export interface CurseForgeProjectFile {
  id: number;
  displayName: string;
  fileName: string;
  fileDate: string;
  fileLength: number;
  releaseType: 'alpha' | 'beta' | 'release';
  fileStatus: number;
  downloadUrl: string;
  gameVersions: string[];
  dependencies?: Array<{
    slug: string;
    projectID?: string;
    type: 'embeddedLibrary' | 'incompatible' | 'optionalDependency' | 'requiredDependency' | 'tool';
  }>;
  changelog?: string;
  changelogType?: 'text' | 'html' | 'markdown';
  isAvailable: boolean;
}

export interface CurseForgeProject {
  id: number;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  dateCreated: string;
  dateModified: string;
  dateReleased: string;
  status: number;
  latestFiles?: CurseForgeProjectFile[];
}

export class CurseForgeError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message);
    this.name = 'CurseForgeError';
  }
}

export const CurseForgeService = {
  getApiToken(config: AppConfig): string | null {
    return null;
  },

  extractProjectId(curseforgeUrl: string): string | null {
    if (!curseforgeUrl) return null;
    
    const numericIdMatch = curseforgeUrl.match(/\/projects\/(\d+)/);
    if (numericIdMatch && numericIdMatch[1]) {
      return numericIdMatch[1];
    }
    
    const hashNumericMatch = curseforgeUrl.match(/#\/projects\/(\d+)/);
    if (hashNumericMatch && hashNumericMatch[1]) {
      return hashNumericMatch[1];
    }
    
    const slugMatch = curseforgeUrl.match(/\/(?:projects|mc-mods)\/([^\/\?#]+)/);
    if (slugMatch && slugMatch[1]) {
      return slugMatch[1];
    }
    
    if (/^\d+$/.test(curseforgeUrl)) {
      return curseforgeUrl;
    }
    
    return null;
  },

  extractProjectSlug(curseforgeUrl: string): string | null {
    if (!curseforgeUrl) return null;
    
    // Extract slug from URL like https://www.curseforge.com/minecraft/mc-mods/buildscape
    const slugMatch = curseforgeUrl.match(/\/mc-mods\/([^\/\?#]+)/);
    if (slugMatch && slugMatch[1]) {
      return slugMatch[1];
    }
    
    // Also try /projects/ pattern
    const projectSlugMatch = curseforgeUrl.match(/\/projects\/([^\/\?#]+)/);
    if (projectSlugMatch && projectSlugMatch[1] && !/^\d+$/.test(projectSlugMatch[1])) {
      return projectSlugMatch[1];
    }
    
    // If it's already a slug (not numeric), return it
    if (curseforgeUrl && !/^\d+$/.test(curseforgeUrl) && !curseforgeUrl.includes('://')) {
      return curseforgeUrl;
    }
    
    return null;
  },

  buildDownloadUrl(projectSlug: string, fileId: number): string {
    return `https://www.curseforge.com/minecraft/mc-mods/${projectSlug}/download/${fileId}`;
  },

  getAuthHeaders(config: AppConfig): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  },

  async getGameVersions(config: AppConfig): Promise<CurseForgeGameVersion[]> {
    try {
      const response = await fetch(`${API_BASE}?action=gameVersions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new CurseForgeError(
          errorData.error || `Failed to fetch game versions: ${response.statusText}`,
          'FETCH_ERROR',
          response.status
        );
      }

      const data = await response.json();
      return data.data || [];
    } catch (error: any) {
      if (error instanceof CurseForgeError) {
        throw error;
      }
      throw new CurseForgeError(
        `Error fetching game versions: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  },

  async getGameDependencies(config: AppConfig): Promise<CurseForgeDependency[]> {
    try {
      const response = await fetch(`${API_BASE}?action=gameDependencies`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new CurseForgeError(
          errorData.error || `Failed to fetch dependencies: ${response.statusText}`,
          'FETCH_ERROR',
          response.status
        );
      }

      const data = await response.json();
      return data.data || [];
    } catch (error: any) {
      if (error instanceof CurseForgeError) {
        throw error;
      }
      throw new CurseForgeError(
        `Error fetching dependencies: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  },

  async getProjectFiles(projectSlug: string, config: AppConfig): Promise<CurseForgeProjectFile[]> {
    try {
      const response = await fetch(`${API_BASE}?action=projectFiles&projectSlug=${encodeURIComponent(projectSlug)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new CurseForgeError(
          errorData.error || `Failed to fetch project files: ${response.statusText}`,
          'FETCH_ERROR',
          response.status
        );
      }

      const data = await response.json();
      const files = data.data || [];
      
      return files.map((file: any) => ({
        id: file.id,
        displayName: file.displayName || file.fileName,
        fileName: file.fileName,
        fileDate: file.fileDate || file.uploadedAt,
        fileLength: file.fileLength || file.fileLengthOnDisk || 0,
        releaseType: file.releaseType || 'release',
        fileStatus: file.fileStatus || 1,
        downloadUrl: file.downloadUrl || '',
        gameVersions: file.gameVersions ? file.gameVersions.map((v: any) => {
          if (typeof v === 'string') return v;
          if (v && typeof v === 'object' && v.versionString) return v.versionString;
          if (v && typeof v === 'object' && v.name) return v.name;
          return String(v);
        }) : [],
        dependencies: file.dependencies || [],
        changelog: file.changelog || file.changelogHtml || file.changelogMarkdown || '',
        changelogType: file.changelogType || (file.changelogHtml ? 'html' : file.changelogMarkdown ? 'markdown' : 'text'),
        isAvailable: file.isAvailable !== false && file.fileStatus === 4, // Status 4 = Approved
      }));
    } catch (error: any) {
      if (error instanceof CurseForgeError) {
        throw error;
      }
      throw new CurseForgeError(
        `Error fetching project files: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  },

  async getProjectInfo(projectSlug: string, config: AppConfig): Promise<CurseForgeProject | null> {
    try {
      const response = await fetch(`${API_BASE}?action=projectInfo&projectSlug=${encodeURIComponent(projectSlug)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new CurseForgeError(
          errorData.error || `Failed to fetch project info: ${response.statusText}`,
          'FETCH_ERROR',
          response.status
        );
      }

      const data = await response.json();
      return data.data || null;
    } catch (error: any) {
      if (error instanceof CurseForgeError) {
        throw error;
      }
      throw new CurseForgeError(
        `Error fetching project info: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  },

  async getLatestRelease(projectSlug: string, config: AppConfig): Promise<CurseForgeProjectFile | null> {
    try {
      const files = await this.getProjectFiles(projectSlug, config);
      if (!files || files.length === 0) {
        return null;
      }

      const releaseFiles = files.filter(f => f.releaseType === 'release' && f.isAvailable);
      if (releaseFiles.length > 0) {
        releaseFiles.sort((a, b) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime());
        return releaseFiles[0];
      }

      const betaFiles = files.filter(f => f.releaseType === 'beta' && f.isAvailable);
      if (betaFiles.length > 0) {
        betaFiles.sort((a, b) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime());
        return betaFiles[0];
      }

      const alphaFiles = files.filter(f => f.releaseType === 'alpha' && f.isAvailable);
      if (alphaFiles.length > 0) {
        alphaFiles.sort((a, b) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime());
        return alphaFiles[0];
      }

      files.sort((a, b) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime());
      return files[0];
    } catch (error: any) {
      if (error instanceof CurseForgeError) {
        throw error;
      }
      throw new CurseForgeError(
        `Error fetching latest release: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  },

  extractModVersionFromFileName(fileName: string): string | null {
    if (!fileName) return null;
    
    const nameWithoutExt = fileName.replace(/\.(jar|zip|rar)$/i, '');
    
    const vPrefixMatch = nameWithoutExt.match(/-?[vV](\d+\.\d+\.\d+(?:\.\d+)?)/);
    if (vPrefixMatch && vPrefixMatch[1]) {
      return vPrefixMatch[1];
    }
    
    const endVersionMatch = nameWithoutExt.match(/-(\d+\.\d+\.\d+(?:\.\d+)?)$/);
    if (endVersionMatch && endVersionMatch[1]) {
      const version = endVersionMatch[1];
      const parts = version.split('.').map(Number);
      const mcVersionPattern = /1\.\d+\.\d+/;
      if (mcVersionPattern.test(nameWithoutExt) && parts[0] === 1) {
      } else {
        return version;
      }
    }
    
    const anyVersionMatch = nameWithoutExt.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/g);
    if (anyVersionMatch && anyVersionMatch.length > 0) {
      for (const match of anyVersionMatch) {
        const parts = match.split('.').map(Number);
        if (parts[0] !== 1) {
          return match;
        }
      }
      return anyVersionMatch[anyVersionMatch.length - 1];
    }
    
    return null;
  },

  async syncVersionsFromCurseForge(config: AppConfig): Promise<{
    mcVersions: string[];
    modVersions: string[];
    latestModVersion: string;
    latestMcVersions: string;
  }> {
    try {
      const projectSlug = config.curseforgeProjectSlug || this.extractProjectId(config.links.curseforge);
      let latestModVersion = config.hero.latestModVersion;
      let latestMcVersions = config.hero.latestMcVersions;
      let mcVersions: string[] = config.mcVersions;
      let modVersions: string[] = config.modVersions;

      if (!projectSlug) {
        throw new CurseForgeError('Project slug is required. Please set it in the CurseForge configuration.');
      }

      try {
        const files = await this.getProjectFiles(projectSlug, config);
        
        if (files && files.length > 0) {
          const allMcVersions = new Set<string>();
          const allModVersions = new Set<string>();
          
          files.forEach((file: any) => {
            const fileName = file.fileName || file.displayName || '';
            const modVersion = this.extractModVersionFromFileName(fileName);
            if (modVersion) {
              allModVersions.add(modVersion);
            }
            if (file.gameVersions && Array.isArray(file.gameVersions)) {
              file.gameVersions.forEach((version: any) => {
                let versionString: string = '';
                if (typeof version === 'string') {
                  versionString = version;
                } else if (version && typeof version === 'object' && version.versionString) {
                  versionString = version.versionString;
                } else if (version && typeof version === 'object' && version.name) {
                  versionString = version.name;
                }
                
                if (versionString && versionString.match(/^\d+\.\d+(\.\d+)?$/)) {
                  allMcVersions.add(versionString);
                }
              });
            }
          });

          mcVersions = Array.from(allMcVersions).sort((a, b) => {
            const partsA = a.split('.').map(Number);
            const partsB = b.split('.').map(Number);
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
              const valA = partsA[i] || 0;
              const valB = partsB[i] || 0;
              if (valA > valB) return -1;
              if (valA < valB) return 1;
            }
            return 0;
          });

          modVersions = Array.from(allModVersions).sort((a, b) => {
            const partsA = a.split('.').map(Number);
            const partsB = b.split('.').map(Number);
            for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
              const valA = partsA[i] || 0;
              const valB = partsB[i] || 0;
              if (valA > valB) return -1;
              if (valA < valB) return 1;
            }
            return 0;
          });

          const latestFile = await this.getLatestRelease(projectSlug, config);
          if (latestFile) {
            const fileName = latestFile.fileName || latestFile.displayName || '';
            const extractedVersion = this.extractModVersionFromFileName(fileName);
            if (extractedVersion) {
              latestModVersion = `v${extractedVersion}`;
            } else {
              const versionMatch = latestFile.displayName?.match(/v?(\d+\.\d+\.\d+)/i) || 
                                  latestFile.fileName?.match(/v?(\d+\.\d+\.\d+)/i);
              if (versionMatch) {
                latestModVersion = `v${versionMatch[1]}`;
              }
            }

            if (mcVersions.length > 0) {
              latestMcVersions = mcVersions.slice(0, 2).join(' / ');
            } else if (latestFile.gameVersions && latestFile.gameVersions.length > 0) {
              const supportedVersions: string[] = [];
              
              latestFile.gameVersions.forEach((v: any) => {
                let versionString: string = '';
                if (typeof v === 'string') {
                  versionString = v;
                } else if (v && typeof v === 'object' && v.versionString) {
                  versionString = v.versionString;
                } else if (v && typeof v === 'object' && v.name) {
                  versionString = v.name;
                }
                
                if (versionString && versionString.match(/^\d+\.\d+(\.\d+)?$/)) {
                  supportedVersions.push(versionString);
                }
              });
              
              if (supportedVersions.length > 0) {
                supportedVersions.sort((a: string, b: string) => {
                  const partsA = a.split('.').map(Number);
                  const partsB = b.split('.').map(Number);
                  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                    const valA = partsA[i] || 0;
                    const valB = partsB[i] || 0;
                    if (valA > valB) return -1;
                    if (valA < valB) return 1;
                  }
                  return 0;
                });
                
                latestMcVersions = supportedVersions.slice(0, 2).join(' / ');
              }
            }
          }
        } else {
          throw new CurseForgeError('No files found for this project. Make sure the project slug is correct.');
        }
      } catch (error: any) {
        if (error instanceof CurseForgeError) {
          throw error;
        }
        throw new CurseForgeError(
          `Failed to sync from CurseForge: ${error.message || 'Unknown error'}`,
          'SYNC_ERROR'
        );
      }

      return {
        mcVersions: mcVersions.length > 0 ? mcVersions : config.mcVersions,
        modVersions: modVersions.length > 0 ? modVersions : config.modVersions,
        latestModVersion,
        latestMcVersions,
      };
    } catch (error: any) {
      throw new CurseForgeError(
        `Error syncing versions: ${error.message}`,
        'SYNC_ERROR'
      );
    }
  },
};

