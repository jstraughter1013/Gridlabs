import {
  Box,
  Heading,
  List,
  ListItem,
  Text,
  Badge,
  Flex,
  Divider,
  Button,
  useDisclosure,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  Image,
} from "@chakra-ui/react";
import { AlertTriangle } from "lucide-react";
import { useRef } from "react";
import { DiffSummary } from "../types/DiffSummary";
import { getDiffImageUrl } from "../services/diffService";
import { Link as RouterLink } from "react-router-dom";
import items, { GridItem } from "virtual:gridlabs-map";

interface ChangesPanelProps {
  diffSummary: DiffSummary | null;
}

const ChangesPanel = ({ diffSummary }: ChangesPanelProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = useRef<HTMLButtonElement>(null);
  
  // Helper function to get component ID from name
  const getComponentId = (componentName: string): number | undefined => {
    const item = items.find((file: GridItem) => file.name === componentName);
    return item?.id;
  };

  if (!diffSummary) {
    return null;
  }

  const changedComponents = diffSummary.components.filter((c) => c.hasDiff);
  
  if (changedComponents.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        ref={btnRef}
        position="fixed"
        bottom={6}
        left={6}
        colorScheme="orange"
        leftIcon={<AlertTriangle size={18} />}
        onClick={onOpen}
        size="md"
        borderRadius="full"
        boxShadow="md"
      >
        {changedComponents.length} Changes
      </Button>

      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        finalFocusRef={btnRef}
        size="md"
      >
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">
            <Heading size="md">Visual Changes</Heading>
            <Text fontSize="sm" color="gray.500" mt={1}>
              Comparing current with {diffSummary.previousCommitHash.substring(0, 7)}
            </Text>
          </DrawerHeader>

          <DrawerBody>
            <List spacing={4}>
              {changedComponents.map((component) => (
                <ListItem key={component.name}>
                  <Box
                    p={4}
                    borderWidth="1px"
                    borderRadius="md"
                    _hover={{ bg: "gray.50" }}
                  >
                    <Flex justify="space-between" align="center" mb={2}>
                      <Text fontWeight="bold">{component.name}</Text>
                      <Badge colorScheme="red">
                        {component.diffPercentage.toFixed(1)}% changed
                      </Badge>
                    </Flex>
                    
                    <Text fontSize="sm" mb={3}>{component.summary}</Text>
                    
                    <Image 
                      src={getDiffImageUrl(diffSummary.commitHash, component.name)}
                      alt={`Diff for ${component.name}`}
                      borderRadius="md"
                      fallback={<Box height="100px" bg="gray.100" borderRadius="md" />}
                    />
                    
                    <Flex justify="flex-end" mt={2}>
                      <Button
                        as={RouterLink}
                        to={`/__grid/preview?id=${getComponentId(component.name)}`}
                        size="sm"
                        colorScheme="blue"
                        variant="outline"
                        onClick={onClose}
                        isDisabled={!getComponentId(component.name)}
                      >
                        View Component
                      </Button>
                    </Flex>
                  </Box>
                  <Divider mt={4} />
                </ListItem>
              ))}
            </List>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default ChangesPanel;
