import convert from 'npm-to-yarn';
import {
  CodeBlock,
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
  Pre,
} from 'fumadocs-ui/components/codeblock';

const command = 'npm create @bitakit/app@latest my-app';
const managers = ['npm', 'pnpm', 'yarn', 'bun'] as const;

/**
 * The create command in the same package-manager tabs the documentation uses (Fumadocs), with
 * the same npm-to-yarn conversion and the same remembered choice.
 */
export function CreateCommand() {
  return (
    <CodeBlockTabs
      defaultValue="npm"
      groupId="package-manager"
      persist
      className="create-command w-full max-w-xl text-left"
    >
      <CodeBlockTabsList>
        {managers.map((manager) => (
          <CodeBlockTabsTrigger key={manager} value={manager}>
            {manager}
          </CodeBlockTabsTrigger>
        ))}
      </CodeBlockTabsList>
      {managers.map((manager) => (
        <CodeBlockTab key={manager} value={manager}>
          {/* The markup Fumadocs' rehype step produces: a `shiki` block with one `.line` per line. */}
          <CodeBlock className="shiki">
            <Pre>
              <code>
                <span className="line">
                  {manager === 'npm' ? command : convert(command, manager)}
                </span>
              </code>
            </Pre>
          </CodeBlock>
        </CodeBlockTab>
      ))}
    </CodeBlockTabs>
  );
}
