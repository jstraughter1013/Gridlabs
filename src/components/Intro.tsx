import { Box, Heading, Text, Code } from "@chakra-ui/react";

const Intro = () => (
  <Box p={8} maxW="3xl">
    <Heading size="lg" mb={4}>
      👋 Welcome to Grid Lab
    </Heading>

    <Text mb={2}>
      Every <Code>.tsx</Code> file you drop into <Code>src/</Code> shows up here
      instantly – no routes or Storybook stories needed.
    </Text>

    <Text mb={2}>
      Click a tile to preview the component in isolation. Use the blue "Copy
      link" button to share this exact view.
    </Text>

    <Text fontSize="sm" color="gray.500">
      Commit <Code>{import.meta.env.VITE_COMMIT_SHA?.slice(0, 7)}</Code>
    </Text>
  </Box>
);

export default Intro;