import { Box, Heading, Text, Container, VStack } from '@chakra-ui/react';

const GridLabPlaceholder = () => {
  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={6} align="center" textAlign="center">
        <Heading as="h1" size="2xl">
          Grid Lab
        </Heading>
        <Text fontSize="xl">Grid coming soon</Text>
        <Box 
          w="100%" 
          h="300px" 
          bg="gray.100" 
          borderRadius="md" 
          display="flex" 
          alignItems="center" 
          justifyContent="center"
        >
          <Text fontSize="lg" color="gray.500">Placeholder for Grid Component</Text>
        </Box>
      </VStack>
    </Container>
  );
};

export default GridLabPlaceholder;