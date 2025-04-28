import { Box, Heading, Text, Container, VStack, Button } from '@chakra-ui/react';
import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={6} align="center" textAlign="center">
        <Heading as="h1" size="2xl">
          GridLabs
        </Heading>
        <Text fontSize="xl">It works! Your Vite + React + TypeScript app is ready.</Text>
        <Box mt={4}>
          <Button 
            as={Link} 
            to="/__grid" 
            colorScheme="blue"
            size="lg"
          >
            View Grid Lab
          </Button>
        </Box>
      </VStack>
    </Container>
  );
};

export default Landing;