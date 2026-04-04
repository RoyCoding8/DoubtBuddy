import { StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import Katex from 'react-native-katex';

import { colors, radii, spacing, typography } from '../constants/theme';

interface MarkdownMathViewProps {
  markdown: string;
}

const extractDisplayMath = (markdown: string): string[] => {
  const displayMathRegex = /\$\$([\s\S]*?)\$\$/g;
  const blocks: string[] = [];
  let match: RegExpExecArray | null = displayMathRegex.exec(markdown);

  while (match) {
    const expression = match[1]?.trim();
    if (expression) {
      blocks.push(expression);
    }
    match = displayMathRegex.exec(markdown);
  }

  return blocks;
};

const removeDisplayMath = (markdown: string): string => markdown.replace(/\$\$([\s\S]*?)\$\$/g, '').trim();

export const MarkdownMathView = ({ markdown }: MarkdownMathViewProps) => {
  const blocks = extractDisplayMath(markdown);
  const markdownWithoutDisplayMath = removeDisplayMath(markdown);

  return (
    <View style={styles.wrapper}>
      <Markdown style={markdownStyles}>{markdownWithoutDisplayMath}</Markdown>
      {blocks.map((expr, index) => (
        <View key={`${expr}_${index}`} style={styles.mathBlock}>
          <Katex
            expression={expr}
            displayMode
            throwOnError={false}
            inlineStyle="font-size: 18px; color: #F6F8FF;"
            style={styles.mathWebView}
          />
        </View>
      ))}
      {markdown.length === 0 ? <Text style={styles.placeholder}>Solution will appear here.</Text> : null}
    </View>
  );
};

const markdownStyles = {
  body: {
    color: colors.textPrimary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  heading3: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    marginBottom: 8,
  },
  strong: {
    color: colors.textPrimary,
  },
  bullet_list: {
    color: colors.textPrimary,
  },
};

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    minHeight: 160,
  },
  mathBlock: {
    marginTop: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: '#0B1322',
    padding: spacing.sm,
  },
  mathWebView: {
    backgroundColor: 'transparent',
    minHeight: 56,
  },
  placeholder: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
});
