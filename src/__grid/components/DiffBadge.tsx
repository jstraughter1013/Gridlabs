import { Badge, Tooltip, Box } from "@chakra-ui/react";
import { ComponentDiff } from "../types/DiffSummary";

interface DiffBadgeProps {
  diff: ComponentDiff;
}

const DiffBadge = ({ diff }: DiffBadgeProps) => {
  if (!diff || !diff.hasDiff) {
    return null;
  }

  // Format the diff percentage to 1 decimal place
  const diffPercentage = diff.diffPercentage.toFixed(1);

  return (
    <Tooltip
      label={diff.summary}
      placement="top"
      hasArrow
      bg="gray.700"
      color="white"
      fontSize="sm"
      maxW="300px"
    >
      <Box position="absolute" top={2} right={2} zIndex={1}>
        <Badge
          colorScheme="red"
          variant="solid"
          borderRadius="full"
          px={2}
          py={1}
          fontSize="xs"
        >
          {diffPercentage}% changed
        </Badge>
      </Box>
    </Tooltip>
  );
};

export default DiffBadge;
