import { SimpleGrid, Box, Text } from '@chakra-ui/react';
import items from 'virtual:gridlabs-map';
import { Link } from 'react-router-dom';

const GridView = () => (
  <SimpleGrid columns={[1, 2, 3]} spacing={4} p={6}>
    {items.map(({ id, name }) => (
      <Box
        key={id}
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        _hover={{ shadow: 'md' }}
      >
        <Box bg="gray.50" p={2}>
          <Text fontSize="sm" isTruncated>
            {name}
          </Text>
        </Box>
        <Box as={Link} to={`/__grid/preview?id=${id}`} h="240px" w="100%" />
      </Box>
    ))}
  </SimpleGrid>
);

export default GridView;