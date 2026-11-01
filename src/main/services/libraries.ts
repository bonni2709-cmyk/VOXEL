import { isAllowed, type OsName, type Rule, type RuleContext } from './rules';

export interface Artifact {
  path: string;
  url: string;
  sha1?: string;
  size?: number;
}

export interface NativeArtifact extends Artifact {
  exclude: string[];
}

export interface RawLibrary {
  name: string;
  url?: string;
  downloads?: {
    artifact?: Artifact;
    classifiers?: Record<string, Artifact>;
  };
  rules?: Rule[];
  natives?: Partial<Record<OsName, string>>;
  extract?: { exclude?: string[] };
}

export interface ResolvedLibraries {
  artifacts: Artifact[];
  natives: NativeArtifact[];
}

/** group:artifact:version[:classifier] → maven-путь. */
export function mavenPath(name: string): string {
  const [group, artifact, version, classifier] = name.split(':');
  if (!group || !artifact || !version) throw new Error(`Некорректное имя библиотеки: ${name}`);
  const file = classifier ? `${artifact}-${version}-${classifier}.jar` : `${artifact}-${version}.jar`;
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${file}`;
}

function legacyArtifact(lib: RawLibrary): Artifact | undefined {
  if (!lib.url) return undefined;
  const path = mavenPath(lib.name);
  return { path, url: lib.url + path };
}

/** Выбирает артефакты для текущей ОС, пропуская запрещённые правилами. */
export function resolveLibraries(libs: RawLibrary[], ctx: RuleContext): ResolvedLibraries {
  const artifacts = new Map<string, Artifact>();
  const natives = new Map<string, NativeArtifact>();

  for (const lib of libs) {
    if (!isAllowed(lib.rules, ctx)) continue;

    if (lib.natives) {
      const template = lib.natives[ctx.osName];
      if (!template) continue;
      const classifier = template.replace('${arch}', ctx.arch === 'x64' ? '64' : '32');
      const artifact = lib.downloads?.classifiers?.[classifier];
      if (artifact && !natives.has(artifact.path)) {
        natives.set(artifact.path, { ...artifact, exclude: lib.extract?.exclude ?? [] });
      }
      continue;
    }

    const artifact = lib.downloads?.artifact ?? legacyArtifact(lib);
    if (artifact && !artifacts.has(artifact.path)) artifacts.set(artifact.path, artifact);
  }

  return { artifacts: [...artifacts.values()], natives: [...natives.values()] };
}
